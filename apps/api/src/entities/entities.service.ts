import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Backlink,
  CampaignSessionSummary,
  EntityDetail,
  EntityRelationshipView,
  EntitySummary,
  EntityType,
  TiptapDoc,
} from '@worldbinder/contracts';
import type {
  CreateEntityInput,
  ListEntitiesQuery,
  UpdateEntityInput,
} from '@worldbinder/validation';
import { and, desc, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { entities, entityTags, tags } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { RelationshipsService } from '../relationships/relationships.service';
import {
  RevisionRecorderService,
  type RevisionWriteOptions,
} from '../revisions/revision-recorder.service';
import {
  buildWeightedTsvector,
  extractPlainText,
} from '../search/search-vector.util';
import { SessionsService } from '../sessions/sessions.service';
import { WikiLinksService } from './wiki-links.service';

type EntityRow = typeof entities.$inferSelect;

@Injectable()
export class EntitiesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly relationships: RelationshipsService,
    private readonly wikiLinks: WikiLinksService,
    private readonly sessions: SessionsService,
    private readonly revisionRecorder: RevisionRecorderService,
    private readonly audit: CampaignAuditService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
    input: CreateEntityInput,
  ): Promise<EntityDetail> {
    this.assertCanEdit(membership);
    this.assertCanWriteGmContent(membership, input.gmContentJson);

    const slug = await this.generateUniqueSlug(campaignId, input.name);

    const vectors = buildEntitySearchVectors({
      name: input.name,
      aliases: input.aliases ?? [],
      tags: input.tags ?? [],
      summary: input.summary ?? null,
      publicContentJson: input.publicContentJson ?? null,
      gmContentJson: input.gmContentJson ?? null,
    });

    const entity = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(entities)
        .values({
          campaignId,
          entityType: input.entityType,
          name: input.name,
          slug,
          summary: input.summary ?? null,
          aliasesJson: input.aliases ?? null,
          publicContentJson: input.publicContentJson ?? null,
          gmContentJson: input.gmContentJson ?? null,
          metadataJson: input.metadata ?? null,
          status: input.status ?? 'draft',
          visibility: input.visibility ?? 'public',
          createdByUserId: userId,
          updatedByUserId: userId,
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .returning();

      if (!row) throw new Error('Failed to create entity');

      if (input.tags && input.tags.length > 0) {
        await syncTags(tx, campaignId, row.id, input.tags);
      }

      if (input.publicContentJson !== undefined) {
        await this.wikiLinks.refreshLinks(
          tx,
          campaignId,
          row.id,
          'public',
          input.publicContentJson,
        );
      }
      if (input.gmContentJson !== undefined) {
        await this.wikiLinks.refreshLinks(
          tx,
          campaignId,
          row.id,
          'gm',
          input.gmContentJson,
        );
      }

      await this.revisionRecorder.recordRevision(tx, {
        campaignId,
        resourceType: 'entity',
        resourceId: row.id,
        actorUserId: userId,
        snapshot: toEntityRevisionSnapshot(row, input.tags ?? []),
        allowMerge: true,
      });

      return row;
    });

    return this.toDetail(entity, membership, input.tags ?? []);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
    query: ListEntitiesQuery,
  ): Promise<EntitySummary[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const conditions = [
      eq(entities.campaignId, campaignId),
      isNull(entities.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(entities.visibility, 'public'));
    if (query.entityType)
      conditions.push(eq(entities.entityType, query.entityType));
    if (query.search)
      conditions.push(ilike(entities.name, `%${query.search}%`));

    let rows = await this.db
      .select()
      .from(entities)
      .where(and(...conditions))
      .orderBy(desc(entities.updatedAt));

    if (query.tag) {
      const normalized = normalizeTagName(query.tag);
      const taggedRows = await this.db
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .innerJoin(tags, eq(tags.id, entityTags.tagId))
        .where(
          and(
            eq(tags.campaignId, campaignId),
            eq(tags.normalizedName, normalized),
          ),
        );
      const idSet = new Set(taggedRows.map((r) => r.entityId));
      rows = rows.filter((row) => idSet.has(row.id));
    }

    const tagsByEntity = await this.getTagsForEntities(
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      this.toSummary(row, tagsByEntity.get(row.id) ?? []),
    );
  }

  async getById(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<EntityDetail> {
    const entity = await this.requireVisibleEntity(
      campaignId,
      entityId,
      membership,
    );
    const tagNames = await this.getEntityTags(entityId);
    return this.toDetail(entity, membership, tagNames);
  }

  async getRelationships(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<EntityRelationshipView[]> {
    await this.requireVisibleEntity(campaignId, entityId, membership);
    return this.relationships.neighborhood(campaignId, entityId, membership);
  }

  async getBacklinks(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<Backlink[]> {
    await this.requireVisibleEntity(campaignId, entityId, membership);
    return this.wikiLinks.backlinks(campaignId, entityId, membership);
  }

  async getSessionAppearances(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<CampaignSessionSummary[]> {
    await this.requireVisibleEntity(campaignId, entityId, membership);
    return this.sessions.listForEntity(campaignId, entityId, membership);
  }

  async update(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
    userId: string,
    input: UpdateEntityInput,
    revisionOptions?: RevisionWriteOptions,
  ): Promise<EntityDetail> {
    this.assertCanEdit(membership);
    this.assertCanWriteGmContent(membership, input.gmContentJson);

    const existing = await this.requireVisibleEntity(
      campaignId,
      entityId,
      membership,
    );

    if (existing.entityType !== input.entityType) {
      throw new ForbiddenException(
        'Entity type cannot be changed after creation',
      );
    }

    if (existing.updatedAt.toISOString() !== input.updatedAt) {
      throw new ConflictException({
        code: 'STALE_UPDATE',
        message:
          'This entry was changed elsewhere. Reload to see the latest version.',
        currentUpdatedAt: existing.updatedAt.toISOString(),
      });
    }

    // Resolved once, up front: tags live in a join table, not this row, so
    // when `input.tags` is undefined this update isn't changing them and
    // the pre-transaction read reflects the current, unaffected state.
    // Reused below both to rebuild the search vector and for the response
    // DTO, replacing what used to be a second, post-transaction query.
    const tagNames = input.tags ?? (await this.getEntityTags(entityId));

    const entity = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(entities)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.aliases !== undefined
            ? { aliasesJson: input.aliases }
            : {}),
          ...(input.publicContentJson !== undefined
            ? { publicContentJson: input.publicContentJson }
            : {}),
          ...(input.gmContentJson !== undefined
            ? { gmContentJson: input.gmContentJson }
            : {}),
          ...(input.metadata !== undefined
            ? { metadataJson: input.metadata }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
          updatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(entities.id, entityId),
            eq(entities.campaignId, campaignId),
            isNull(entities.deletedAt),
          ),
        )
        .returning();

      if (!row) throw new NotFoundException('Entity not found');

      if (input.tags !== undefined) {
        await syncTags(tx, campaignId, entityId, input.tags);
      }

      if (input.publicContentJson !== undefined) {
        await this.wikiLinks.refreshLinks(
          tx,
          campaignId,
          entityId,
          'public',
          input.publicContentJson,
        );
      }
      if (input.gmContentJson !== undefined) {
        await this.wikiLinks.refreshLinks(
          tx,
          campaignId,
          entityId,
          'gm',
          input.gmContentJson,
        );
      }

      // A second statement, not folded into the primary `.set()` above:
      // the tsvector needs the *merged* post-update state (a partial
      // update must not blank out unchanged fields from the vector), and
      // tags specifically aren't available until `syncTags()` above has
      // resolved them.
      const vectors = buildEntitySearchVectors({
        name: input.name !== undefined ? input.name : existing.name,
        aliases:
          input.aliases !== undefined
            ? input.aliases
            : ((existing.aliasesJson as string[] | null) ?? []),
        tags: tagNames,
        summary: input.summary !== undefined ? input.summary : existing.summary,
        publicContentJson:
          input.publicContentJson !== undefined
            ? input.publicContentJson
            : (existing.publicContentJson as TiptapDoc | null),
        gmContentJson:
          input.gmContentJson !== undefined
            ? input.gmContentJson
            : (existing.gmContentJson as TiptapDoc | null),
      });

      await tx
        .update(entities)
        .set({
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .where(eq(entities.id, entityId));

      await this.revisionRecorder.recordRevision(tx, {
        campaignId,
        resourceType: 'entity',
        resourceId: entityId,
        actorUserId: userId,
        snapshot: toEntityRevisionSnapshot(row, tagNames),
        changeSummary: revisionOptions?.changeSummary,
        allowMerge: revisionOptions?.allowMerge ?? true,
      });

      return row;
    });

    return this.toDetail(entity, membership, tagNames);
  }

  async delete(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanEdit(membership);

    const [updated] = await this.db
      .update(entities)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      )
      .returning({ id: entities.id });

    if (!updated) throw new NotFoundException('Entity not found');

    await this.audit.record({
      campaignId,
      type: 'destructive_action',
      actorUserId: membership.userId,
      targetResourceType: 'entity',
      targetResourceId: entityId,
      metadata: { action: 'delete' },
    });
  }

  private assertCanEdit(membership: CampaignMembership): void {
    if (!this.policy.canEditEntities(membership.role)) {
      throw new ForbiddenException('You cannot edit entities in this campaign');
    }
  }

  /** You can't write a section you're not allowed to read — prevents an
   * editor without secret access from blindly overwriting GM notes they've
   * never seen. */
  private assertCanWriteGmContent(
    membership: CampaignMembership,
    gmContentJson: unknown,
  ): void {
    if (
      gmContentJson !== undefined &&
      !this.policy.canViewGmContent(
        membership.role,
        membership.editorSecretAccess,
      )
    ) {
      throw new ForbiddenException(
        'You cannot edit GM-only content for this entity',
      );
    }
  }

  private async requireEntity(
    campaignId: string,
    entityId: string,
  ): Promise<EntityRow> {
    const [entity] = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    if (!entity) throw new NotFoundException('Entity not found');
    return entity;
  }

  private async requireVisibleEntity(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<EntityRow> {
    const entity = await this.requireEntity(campaignId, entityId);
    const canSee = this.policy.canViewVisibility(
      entity.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Entity not found');
    return entity;
  }

  private async getTagsForEntities(
    entityIds: string[],
  ): Promise<Map<string, string[]>> {
    if (entityIds.length === 0) return new Map();

    const rows = await this.db
      .select({ entityId: entityTags.entityId, name: tags.name })
      .from(entityTags)
      .innerJoin(tags, eq(tags.id, entityTags.tagId))
      .where(inArray(entityTags.entityId, entityIds));

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.entityId) ?? [];
      list.push(row.name);
      map.set(row.entityId, list);
    }
    return map;
  }

  private async getEntityTags(entityId: string): Promise<string[]> {
    const map = await this.getTagsForEntities([entityId]);
    return map.get(entityId) ?? [];
  }

  private async generateUniqueSlug(
    campaignId: string,
    name: string,
  ): Promise<string> {
    const base = slugify(name) || 'entity';
    let candidate = base;
    let attempt = 0;

    while (attempt < 5) {
      const [existing] = await this.db
        .select({ id: entities.id })
        .from(entities)
        .where(
          and(
            eq(entities.campaignId, campaignId),
            eq(entities.slug, candidate),
          ),
        );
      if (!existing) return candidate;
      candidate = `${base}-${randomBytes(3).toString('hex')}`;
      attempt += 1;
    }

    throw new Error('Failed to generate a unique entity slug');
  }

  private toSummary(entity: EntityRow, tagNames: string[]): EntitySummary {
    return {
      id: entity.id,
      campaignId: entity.campaignId,
      entityType: entity.entityType,
      name: entity.name,
      slug: entity.slug,
      summary: entity.summary,
      aliases: (entity.aliasesJson as string[] | null) ?? [],
      tags: tagNames,
      status: entity.status,
      visibility: entity.visibility,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toDetail(
    entity: EntityRow,
    membership: CampaignMembership,
    tagNames: string[],
  ): EntityDetail {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    return {
      ...this.toSummary(entity, tagNames),
      publicContentJson: entity.publicContentJson as TiptapDoc | null,
      metadataJson: entity.metadataJson as Record<string, unknown> | null,
      ...(canViewGm
        ? { gmContentJson: entity.gmContentJson as TiptapDoc | null }
        : {}),
    };
  }
}

/** Builds both search-vector SQL expressions for an entity row (roadmap
 * §14.2 weights: name/aliases=A, tags/summary=B, body content=C).
 * `gm` additionally folds in `gmContentJson` text; `public` never does —
 * see the `searchVectorPublic`/`searchVectorGm` column comments in
 * `database/schema.ts` for why these stay two separate columns. */
function buildEntitySearchVectors(fields: {
  name: string;
  aliases: string[];
  tags: string[];
  summary: string | null;
  publicContentJson: TiptapDoc | null;
  gmContentJson: TiptapDoc | null;
}): { public: SQL; gm: SQL } {
  const publicContentText = extractPlainText(fields.publicContentJson);
  const gmContentText = extractPlainText(fields.gmContentJson);
  const a = [fields.name, ...fields.aliases];
  const b = [...fields.tags, fields.summary ?? ''];

  return {
    public: buildWeightedTsvector({ a, b, c: [publicContentText] }),
    gm: buildWeightedTsvector({ a, b, c: [publicContentText, gmContentText] }),
  };
}

/** Always the full GM-inclusive shape (roadmap §9.10) — unlike `toDetail()`,
 * never gates `gmContentJson` by viewer. Field-omission for non-GM revision
 * viewers happens at read time in `RevisionsService.list()`, not here. */
function toEntityRevisionSnapshot(
  entity: EntityRow,
  tagNames: string[],
): Record<string, unknown> {
  return {
    entityType: entity.entityType,
    name: entity.name,
    summary: entity.summary,
    aliases: entity.aliasesJson ?? [],
    tags: tagNames,
    status: entity.status,
    visibility: entity.visibility,
    publicContentJson: entity.publicContentJson,
    gmContentJson: entity.gmContentJson,
    metadataJson: entity.metadataJson,
  };
}

/** Maps a stored snapshot back into an `UpdateEntityInput` for
 * `RevisionsService.restore()` to pass into the real `update()` — reused
 * rather than a raw table write so restore gets tag sync, wiki-link
 * refresh, tsvector rebuild, and permission checks for free. `canViewGm`
 * is the *restoring actor's* current permission, not the snapshot's: if
 * they can't view GM content, `gmContentJson` is omitted entirely from the
 * mapped input (same as it never being sent), not silently overwritten —
 * that portion of the resource just isn't touched by this restore. */
export function entitySnapshotToUpdateInput(
  snapshot: Record<string, unknown>,
  canViewGm: boolean,
  updatedAt: string,
): UpdateEntityInput {
  const s = snapshot as {
    entityType: EntityType;
    name: string;
    summary: string | null;
    aliases: string[];
    tags: string[];
    status: EntitySummary['status'];
    visibility: EntitySummary['visibility'];
    publicContentJson: TiptapDoc | null;
    gmContentJson: TiptapDoc | null;
    metadataJson: Record<string, unknown> | null;
  };

  return {
    entityType: s.entityType,
    updatedAt,
    name: s.name,
    summary: s.summary ?? undefined,
    aliases: s.aliases,
    tags: s.tags,
    status: s.status,
    visibility: s.visibility,
    metadata: s.metadataJson ?? undefined,
    publicContentJson: s.publicContentJson ?? undefined,
    ...(canViewGm ? { gmContentJson: s.gmContentJson } : {}),
  } as UpdateEntityInput;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Full-replace sync: the form always submits the complete current tag
 * list, not a diff, so drop existing links and re-link rather than diffing. */
async function syncTags(
  tx: Database,
  campaignId: string,
  entityId: string,
  tagNames: string[],
): Promise<void> {
  const uniqueNames = Array.from(
    new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
  );

  await tx.delete(entityTags).where(eq(entityTags.entityId, entityId));

  if (uniqueNames.length === 0) return;

  const tagIds: string[] = [];
  for (const name of uniqueNames) {
    const normalizedName = normalizeTagName(name);
    const [existingTag] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.campaignId, campaignId),
          eq(tags.normalizedName, normalizedName),
        ),
      );

    if (existingTag) {
      tagIds.push(existingTag.id);
    } else {
      const [created] = await tx
        .insert(tags)
        .values({ campaignId, name, normalizedName })
        .returning({ id: tags.id });
      if (!created) throw new Error('Failed to create tag');
      tagIds.push(created.id);
    }
  }

  await tx
    .insert(entityTags)
    .values(tagIds.map((tagId) => ({ entityId, tagId })));
}
