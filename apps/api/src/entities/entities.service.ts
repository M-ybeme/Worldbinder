import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntityDetail,
  EntitySummary,
  TiptapDoc,
} from '@worldbinder/contracts';
import type {
  CreateEntityInput,
  ListEntitiesQuery,
  UpdateEntityInput,
} from '@worldbinder/validation';
import { and, desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DRIZZLE, type Database } from '../database/database.module';
import { entities, entityTags, tags } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';

type EntityRow = typeof entities.$inferSelect;

@Injectable()
export class EntitiesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
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
        })
        .returning();

      if (!row) throw new Error('Failed to create entity');

      if (input.tags && input.tags.length > 0) {
        await syncTags(tx, campaignId, row.id, input.tags);
      }

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

  async update(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
    userId: string,
    input: UpdateEntityInput,
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

      return row;
    });

    const tagNames = input.tags ?? (await this.getEntityTags(entityId));
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
    const canSee =
      entity.visibility === 'public' ||
      this.policy.canViewGmContent(
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
