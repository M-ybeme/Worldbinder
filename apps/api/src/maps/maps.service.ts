import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntityVisibility,
  MapDetail,
  MapLayerSummary,
  MapPinSummary,
  MapSummary,
} from '@worldbinder/contracts';
import type {
  CreateMapInput,
  CreateMapLayerInput,
  CreateMapPinInput,
  RepositionMapPinInput,
  UpdateMapInput,
  UpdateMapLayerInput,
  UpdateMapPinInput,
} from '@worldbinder/validation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  attachments,
  entities,
  mapLayers,
  mapPins,
  maps,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { StorageService } from '../storage/storage.service';

type MapRow = typeof maps.$inferSelect;
type MapLayerRow = typeof mapLayers.$inferSelect;
type MapPinRow = typeof mapPins.$inferSelect;
type EntityRow = typeof entities.$inferSelect;
type AttachmentRow = typeof attachments.$inferSelect;

export interface PinVisibilityInput {
  mapVisibility: EntityVisibility;
  /** null = the pin has no layer. */
  layerVisibility: EntityVisibility | null;
  pinVisibility: EntityVisibility;
  /** null = the pin has no linked entity. */
  linkedEntityVisibility: EntityVisibility | null;
  linkedEntityDeleted: boolean;
}

/** A pin is visible only if every applicable layer of visibility passes —
 * the map, its own layer (if any), the pin itself, and its linked entity
 * (if any). Mirrors SearchService.searchRelationships' "no anchor entity,
 * so every side's visibility must be checked explicitly" reasoning: without
 * this composition, a `public` pin on a `public` map could leak a
 * `gm_only` entity's existence/location to a player. */
export function isPinVisible(
  input: PinVisibilityInput,
  canViewGm: boolean,
): boolean {
  if (input.linkedEntityDeleted) return false;
  const passes = (v: EntityVisibility) => v === 'public' || canViewGm;
  if (!passes(input.mapVisibility)) return false;
  if (input.layerVisibility !== null && !passes(input.layerVisibility))
    return false;
  if (!passes(input.pinVisibility)) return false;
  if (
    input.linkedEntityVisibility !== null &&
    !passes(input.linkedEntityVisibility)
  )
    return false;
  return true;
}

@Injectable()
export class MapsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly storage: StorageService,
    private readonly audit: CampaignAuditService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    input: CreateMapInput,
  ): Promise<MapSummary> {
    this.assertCanManage(membership);

    const [row] = await this.db
      .insert(maps)
      .values({
        campaignId,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? 'public',
      })
      .returning();
    if (!row) throw new Error('Failed to create map');

    return this.toSummary(row, null);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<MapSummary[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const rows = await this.db
      .select({ map: maps, attachment: attachments })
      .from(maps)
      .leftJoin(attachments, eq(attachments.id, maps.imageAttachmentId))
      .where(eq(maps.campaignId, campaignId))
      .orderBy(asc(maps.name));

    return Promise.all(
      rows
        .filter((row) => row.map.visibility === 'public' || canViewGm)
        .map((row) => this.toSummary(row.map, row.attachment)),
    );
  }

  async getById(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
  ): Promise<MapDetail> {
    const map = await this.requireVisibleMap(campaignId, mapId, membership);
    return this.toDetail(map, membership);
  }

  async update(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
    input: UpdateMapInput,
  ): Promise<MapDetail> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    if (
      input.imageAttachmentId !== undefined &&
      input.imageAttachmentId !== null
    ) {
      await this.requireReadyImageAttachment(
        campaignId,
        input.imageAttachmentId,
      );
    }

    const [row] = await this.db
      .update(maps)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.visibility !== undefined
          ? { visibility: input.visibility }
          : {}),
        ...(input.imageAttachmentId !== undefined
          ? { imageAttachmentId: input.imageAttachmentId }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(maps.id, mapId), eq(maps.campaignId, campaignId)))
      .returning();
    if (!row) throw new NotFoundException('Map not found');

    return this.getById(campaignId, mapId, membership);
  }

  async delete(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);

    const [deleted] = await this.db
      .delete(maps)
      .where(and(eq(maps.id, mapId), eq(maps.campaignId, campaignId)))
      .returning({ id: maps.id });
    if (!deleted) throw new NotFoundException('Map not found');

    await this.audit.record({
      campaignId,
      type: 'destructive_action',
      actorUserId: membership.userId,
      targetResourceType: 'map',
      targetResourceId: mapId,
      metadata: { action: 'delete' },
    });
  }

  async createLayer(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
    input: CreateMapLayerInput,
  ): Promise<MapLayerSummary> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    const [row] = await this.db
      .insert(mapLayers)
      .values({
        mapId,
        name: input.name,
        displayOrder: input.displayOrder ?? 0,
        visibility: input.visibility ?? 'public',
      })
      .returning();
    if (!row) throw new Error('Failed to create map layer');

    return toLayerSummary(row);
  }

  async updateLayer(
    campaignId: string,
    mapId: string,
    layerId: string,
    membership: CampaignMembership,
    input: UpdateMapLayerInput,
  ): Promise<MapLayerSummary> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    const [row] = await this.db
      .update(mapLayers)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.displayOrder !== undefined
          ? { displayOrder: input.displayOrder }
          : {}),
        ...(input.visibility !== undefined
          ? { visibility: input.visibility }
          : {}),
      })
      .where(and(eq(mapLayers.id, layerId), eq(mapLayers.mapId, mapId)))
      .returning();
    if (!row) throw new NotFoundException('Map layer not found');

    return toLayerSummary(row);
  }

  async deleteLayer(
    campaignId: string,
    mapId: string,
    layerId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    const [deleted] = await this.db
      .delete(mapLayers)
      .where(and(eq(mapLayers.id, layerId), eq(mapLayers.mapId, mapId)))
      .returning({ id: mapLayers.id });
    if (!deleted) throw new NotFoundException('Map layer not found');
  }

  async createPin(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
    input: CreateMapPinInput,
  ): Promise<MapPinSummary> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);
    if (input.layerId) await this.requireLayerOnMap(mapId, input.layerId);
    if (input.locationEntityId) {
      await this.requireEntityInCampaign(campaignId, input.locationEntityId);
    }

    const [row] = await this.db
      .insert(mapPins)
      .values({
        mapId,
        layerId: input.layerId ?? null,
        locationEntityId: input.locationEntityId ?? null,
        label: input.label ?? null,
        xNormalized: input.xNormalized,
        yNormalized: input.yNormalized,
        visibility: input.visibility ?? 'public',
      })
      .returning();
    if (!row) throw new Error('Failed to create map pin');

    return this.resolvePinSummary(row);
  }

  async updatePin(
    campaignId: string,
    mapId: string,
    pinId: string,
    membership: CampaignMembership,
    input: UpdateMapPinInput,
  ): Promise<MapPinSummary> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);
    if (input.layerId) await this.requireLayerOnMap(mapId, input.layerId);
    if (input.locationEntityId) {
      await this.requireEntityInCampaign(campaignId, input.locationEntityId);
    }

    const [row] = await this.db
      .update(mapPins)
      .set({
        ...(input.layerId !== undefined ? { layerId: input.layerId } : {}),
        ...(input.locationEntityId !== undefined
          ? { locationEntityId: input.locationEntityId }
          : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.xNormalized !== undefined
          ? { xNormalized: input.xNormalized }
          : {}),
        ...(input.yNormalized !== undefined
          ? { yNormalized: input.yNormalized }
          : {}),
        ...(input.visibility !== undefined
          ? { visibility: input.visibility }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(mapPins.id, pinId), eq(mapPins.mapId, mapId)))
      .returning();
    if (!row) throw new NotFoundException('Map pin not found');

    return this.resolvePinSummary(row);
  }

  /** Narrow drag/reposition endpoint — touches only the two coordinate
   * fields, never label/visibility/layer, so a fast-firing drag PATCH can
   * never clobber a concurrent edit-form save. No optimistic-concurrency
   * check (documented scope note — last-write-wins is fine here). */
  async repositionPin(
    campaignId: string,
    mapId: string,
    pinId: string,
    membership: CampaignMembership,
    input: RepositionMapPinInput,
  ): Promise<MapPinSummary> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    const [row] = await this.db
      .update(mapPins)
      .set({
        xNormalized: input.xNormalized,
        yNormalized: input.yNormalized,
        updatedAt: new Date(),
      })
      .where(and(eq(mapPins.id, pinId), eq(mapPins.mapId, mapId)))
      .returning();
    if (!row) throw new NotFoundException('Map pin not found');

    return this.resolvePinSummary(row);
  }

  async deletePin(
    campaignId: string,
    mapId: string,
    pinId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);
    await this.requireMap(campaignId, mapId);

    const [deleted] = await this.db
      .delete(mapPins)
      .where(and(eq(mapPins.id, pinId), eq(mapPins.mapId, mapId)))
      .returning({ id: mapPins.id });
    if (!deleted) throw new NotFoundException('Map pin not found');
  }

  private async toDetail(
    map: MapRow,
    membership: CampaignMembership,
  ): Promise<MapDetail> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const [attachmentRow, layerRows, pinRows] = await Promise.all([
      map.imageAttachmentId
        ? this.getAttachment(map.imageAttachmentId)
        : Promise.resolve(null),
      this.db
        .select()
        .from(mapLayers)
        .where(eq(mapLayers.mapId, map.id))
        .orderBy(asc(mapLayers.displayOrder)),
      this.db
        .select({ pin: mapPins, entity: entities })
        .from(mapPins)
        .leftJoin(entities, eq(entities.id, mapPins.locationEntityId))
        .where(eq(mapPins.mapId, map.id))
        .orderBy(asc(mapPins.createdAt)),
    ]);

    const layerVisibilityById = new Map(
      layerRows.map((layer) => [layer.id, layer.visibility]),
    );

    const visiblePins = pinRows
      .filter((row) => {
        const linkedEntityDeleted = row.entity
          ? row.entity.deletedAt !== null
          : false;
        const linkedEntityVisibility =
          row.entity && !linkedEntityDeleted ? row.entity.visibility : null;
        return isPinVisible(
          {
            mapVisibility: map.visibility,
            layerVisibility: row.pin.layerId
              ? (layerVisibilityById.get(row.pin.layerId) ?? null)
              : null,
            pinVisibility: row.pin.visibility,
            linkedEntityVisibility,
            linkedEntityDeleted,
          },
          canViewGm,
        );
      })
      .map((row) => this.toPinSummary(row.pin, row.entity));

    const visibleLayers = layerRows
      .filter((layer) => layer.visibility === 'public' || canViewGm)
      .map(toLayerSummary);

    return {
      ...(await this.toSummary(map, attachmentRow)),
      layers: visibleLayers,
      pins: visiblePins,
    };
  }

  /** create/update/reposition only get back the bare `mapPins` row from
   * their `.returning()` call — this fetches the linked entity (if any) so
   * the response's denormalized `locationEntityName`/`locationEntityType`
   * fields are populated the same way `toDetail()`'s joined query already
   * populates them, rather than always coming back null. */
  private async resolvePinSummary(pin: MapPinRow): Promise<MapPinSummary> {
    if (!pin.locationEntityId) return this.toPinSummary(pin);
    const [entity] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, pin.locationEntityId));
    return this.toPinSummary(pin, entity ?? null);
  }

  private toPinSummary(
    pin: MapPinRow,
    entity?: EntityRow | null,
  ): MapPinSummary {
    const linkedEntity = entity && entity.deletedAt === null ? entity : null;
    return {
      id: pin.id,
      mapId: pin.mapId,
      layerId: pin.layerId,
      locationEntityId: pin.locationEntityId,
      locationEntityName: linkedEntity?.name ?? null,
      locationEntityType: linkedEntity?.entityType ?? null,
      label: pin.label,
      xNormalized: pin.xNormalized,
      yNormalized: pin.yNormalized,
      visibility: pin.visibility,
      createdAt: pin.createdAt.toISOString(),
      updatedAt: pin.updatedAt.toISOString(),
    };
  }

  private async toSummary(
    map: MapRow,
    attachment: AttachmentRow | null,
  ): Promise<MapSummary> {
    const image =
      attachment && attachment.status === 'ready'
        ? {
            url: await this.storage.presignDownload(
              attachment.storageKey,
              attachment.originalFilename,
            ),
            width: attachment.width,
            height: attachment.height,
          }
        : null;

    return {
      id: map.id,
      campaignId: map.campaignId,
      name: map.name,
      description: map.description,
      visibility: map.visibility,
      imageUrl: image?.url ?? null,
      imageWidth: image?.width ?? null,
      imageHeight: image?.height ?? null,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
    };
  }

  private async getAttachment(
    attachmentId: string,
  ): Promise<AttachmentRow | null> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));
    return row ?? null;
  }

  /** Direct DRIZZLE read of `attachments`, not an injected AttachmentsService
   * — same "read a sibling table directly" precedent as
   * CampaignsService.requireReadyImageAttachment — avoids a MapsModule <->
   * AttachmentsModule dependency entirely. */
  private async requireReadyImageAttachment(
    campaignId: string,
    attachmentId: string,
  ): Promise<void> {
    const [attachment] = await this.db
      .select({
        campaignId: attachments.campaignId,
        status: attachments.status,
        detectedMimeType: attachments.detectedMimeType,
      })
      .from(attachments)
      .where(
        and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)),
      );

    if (!attachment || attachment.campaignId !== campaignId) {
      throw new NotFoundException('Attachment not found in this campaign');
    }
    if (attachment.status !== 'ready') {
      throw new ForbiddenException(
        'Attachment is not ready to be used as a map image',
      );
    }
    if (!attachment.detectedMimeType?.startsWith('image/')) {
      throw new ForbiddenException('Map image must be an image attachment');
    }
  }

  private async requireMap(campaignId: string, mapId: string): Promise<MapRow> {
    const [row] = await this.db
      .select()
      .from(maps)
      .where(and(eq(maps.id, mapId), eq(maps.campaignId, campaignId)));
    if (!row) throw new NotFoundException('Map not found');
    return row;
  }

  private async requireVisibleMap(
    campaignId: string,
    mapId: string,
    membership: CampaignMembership,
  ): Promise<MapRow> {
    const map = await this.requireMap(campaignId, mapId);
    const canSee = this.policy.canViewVisibility(
      map.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Map not found');
    return map;
  }

  private async requireLayerOnMap(
    mapId: string,
    layerId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: mapLayers.id })
      .from(mapLayers)
      .where(and(eq(mapLayers.id, layerId), eq(mapLayers.mapId, mapId)));
    if (!row) {
      throw new BadRequestException('Layer does not belong to this map');
    }
  }

  private async requireEntityInCampaign(
    campaignId: string,
    entityId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    if (!row) {
      throw new BadRequestException(
        'Linked entity does not belong to this campaign',
      );
    }
  }

  private assertCanManage(membership: CampaignMembership): void {
    if (!this.policy.canManageMaps(membership.role)) {
      throw new ForbiddenException('You cannot manage maps in this campaign');
    }
  }
}

function toLayerSummary(layer: MapLayerRow): MapLayerSummary {
  return {
    id: layer.id,
    mapId: layer.mapId,
    name: layer.name,
    displayOrder: layer.displayOrder,
    visibility: layer.visibility,
  };
}
