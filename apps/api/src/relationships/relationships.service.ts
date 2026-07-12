import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntityRelationship,
  EntityRelationshipView,
  EntitySummary,
  EntityType,
} from '@worldbinder/contracts';
import type {
  CreateRelationshipInput,
  UpdateRelationshipInput,
} from '@worldbinder/validation';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  entities,
  entityRelationships,
  relationshipTypes,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { RelationshipTypesService } from './relationship-types.service';

type RelationshipRow = typeof entityRelationships.$inferSelect;
type EntityRow = typeof entities.$inferSelect;
type RelationshipTypeRow = typeof relationshipTypes.$inferSelect;

@Injectable()
export class RelationshipsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly types: RelationshipTypesService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
    input: CreateRelationshipInput,
  ): Promise<EntityRelationship> {
    this.assertCanEdit(membership);

    const type = await this.types.requireById(
      campaignId,
      input.relationshipTypeId,
    );
    const source = await this.requireEntity(campaignId, input.sourceEntityId);
    const target = await this.requireEntity(campaignId, input.targetEntityId);

    this.assertTypeCompatible(type, source.entityType, target.entityType);
    await this.assertNoDuplicate(
      campaignId,
      type,
      input.sourceEntityId,
      input.targetEntityId,
    );

    const [row] = await this.db
      .insert(entityRelationships)
      .values({
        campaignId,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        relationshipTypeId: input.relationshipTypeId,
        description: input.description ?? null,
        visibility: input.visibility ?? type.defaultVisibility,
        createdByUserId: userId,
      })
      .returning();

    if (!row) throw new Error('Failed to create relationship');
    return toContract(row);
  }

  async update(
    campaignId: string,
    relationshipId: string,
    membership: CampaignMembership,
    input: UpdateRelationshipInput,
  ): Promise<EntityRelationship> {
    this.assertCanEdit(membership);

    const [row] = await this.db
      .update(entityRelationships)
      .set({
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.visibility !== undefined
          ? { visibility: input.visibility }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(entityRelationships.id, relationshipId),
          eq(entityRelationships.campaignId, campaignId),
        ),
      )
      .returning();

    if (!row) throw new NotFoundException('Relationship not found');
    return toContract(row);
  }

  async delete(
    campaignId: string,
    relationshipId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanEdit(membership);

    const [row] = await this.db
      .delete(entityRelationships)
      .where(
        and(
          eq(entityRelationships.id, relationshipId),
          eq(entityRelationships.campaignId, campaignId),
        ),
      )
      .returning({ id: entityRelationships.id });

    if (!row) throw new NotFoundException('Relationship not found');
  }

  /** All relationships touching `entityId`, projected to whichever
   * direction applies (forward label + the target entity for outgoing rows,
   * reverse label + the source entity for incoming rows) — no reverse row
   * is ever stored, per roadmap §9.5. */
  async neighborhood(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<EntityRelationshipView[]> {
    const outgoing = await this.db
      .select({
        relationship: entityRelationships,
        label: relationshipTypes.forwardLabel,
        other: entities,
      })
      .from(entityRelationships)
      .innerJoin(
        relationshipTypes,
        eq(relationshipTypes.id, entityRelationships.relationshipTypeId),
      )
      .innerJoin(entities, eq(entities.id, entityRelationships.targetEntityId))
      .where(
        and(
          eq(entityRelationships.campaignId, campaignId),
          eq(entityRelationships.sourceEntityId, entityId),
          isNull(entities.deletedAt),
        ),
      );

    const incoming = await this.db
      .select({
        relationship: entityRelationships,
        label: relationshipTypes.reverseLabel,
        other: entities,
      })
      .from(entityRelationships)
      .innerJoin(
        relationshipTypes,
        eq(relationshipTypes.id, entityRelationships.relationshipTypeId),
      )
      .innerJoin(entities, eq(entities.id, entityRelationships.sourceEntityId))
      .where(
        and(
          eq(entityRelationships.campaignId, campaignId),
          eq(entityRelationships.targetEntityId, entityId),
          isNull(entities.deletedAt),
        ),
      );

    const views: EntityRelationshipView[] = [];
    for (const row of outgoing) {
      if (
        !this.canSeeRow(
          row.relationship.visibility,
          row.other.visibility,
          membership,
        )
      )
        continue;
      views.push(
        this.toView(row.relationship, 'outgoing', row.label, row.other),
      );
    }
    for (const row of incoming) {
      if (
        !this.canSeeRow(
          row.relationship.visibility,
          row.other.visibility,
          membership,
        )
      )
        continue;
      views.push(
        this.toView(row.relationship, 'incoming', row.label, row.other),
      );
    }
    return views;
  }

  /** A relationship leaks nothing only if both the row itself *and* the
   * other endpoint's own visibility clear the viewer's access — a public
   * relationship pointing at a `gm_only` entity must not reveal that
   * entity's existence (Milestone 4 exit criterion: hidden relationships
   * do not leak). */
  private canSeeRow(
    relationshipVisibility: RelationshipRow['visibility'],
    otherEntityVisibility: EntityRow['visibility'],
    membership: CampaignMembership,
  ): boolean {
    return (
      this.policy.canViewVisibility(
        relationshipVisibility,
        membership.role,
        membership.editorSecretAccess,
      ) &&
      this.policy.canViewVisibility(
        otherEntityVisibility,
        membership.role,
        membership.editorSecretAccess,
      )
    );
  }

  private toView(
    relationship: RelationshipRow,
    direction: 'outgoing' | 'incoming',
    label: string,
    other: EntityRow,
  ): EntityRelationshipView {
    return {
      relationshipId: relationship.id,
      direction,
      label,
      otherEntity: toEntitySummary(other),
      description: relationship.description,
      visibility: relationship.visibility,
    };
  }

  private async requireEntity(
    campaignId: string,
    entityId: string,
  ): Promise<EntityRow> {
    const [row] = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException('Entity not found');
    return row;
  }

  private assertTypeCompatible(
    type: RelationshipTypeRow,
    sourceType: EntityType,
    targetType: EntityType,
  ): void {
    const result = checkRelationshipTypeCompatibility(
      type,
      sourceType,
      targetType,
    );
    if (result.compatible) return;

    if (result.reason === 'source') {
      throw new BadRequestException(
        `"${type.forwardLabel}" cannot originate from a ${sourceType}`,
      );
    }
    throw new BadRequestException(
      `"${type.forwardLabel}" cannot target a ${targetType}`,
    );
  }

  /** For a symmetric type, A→B and B→A represent the same fact — both
   * orderings count as a duplicate. For an asymmetric type only the exact
   * ordering does. */
  private async assertNoDuplicate(
    campaignId: string,
    type: RelationshipTypeRow,
    sourceEntityId: string,
    targetEntityId: string,
  ): Promise<void> {
    if (type.allowDuplicates) return;

    const sameDirection = and(
      eq(entityRelationships.sourceEntityId, sourceEntityId),
      eq(entityRelationships.targetEntityId, targetEntityId),
    );
    const swapped = and(
      eq(entityRelationships.sourceEntityId, targetEntityId),
      eq(entityRelationships.targetEntityId, sourceEntityId),
    );

    const [existing] = await this.db
      .select({ id: entityRelationships.id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.campaignId, campaignId),
          eq(entityRelationships.relationshipTypeId, type.id),
          type.symmetric ? or(sameDirection, swapped) : sameDirection,
        ),
      );

    if (existing) {
      throw new ConflictException('This relationship already exists');
    }
  }

  private assertCanEdit(membership: CampaignMembership): void {
    if (!this.policy.canEditEntities(membership.role)) {
      throw new ForbiddenException(
        'You cannot manage relationships in this campaign',
      );
    }
  }
}

export type RelationshipTypeCompatibilityResult =
  { compatible: true } | { compatible: false; reason: 'source' | 'target' };

/** Pure compatibility check, factored out of `assertTypeCompatible` so it's
 * unit-testable without a database (roadmap §20.1 lists "relationship
 * compatibility" as a unit-test target). A `null` allow-list means any
 * entity type is permitted. */
export function checkRelationshipTypeCompatibility(
  type: Pick<
    RelationshipTypeRow,
    'allowedSourceTypesJson' | 'allowedTargetTypesJson'
  >,
  sourceType: EntityType,
  targetType: EntityType,
): RelationshipTypeCompatibilityResult {
  const allowedSource = type.allowedSourceTypesJson as EntityType[] | null;
  const allowedTarget = type.allowedTargetTypesJson as EntityType[] | null;

  if (allowedSource && !allowedSource.includes(sourceType)) {
    return { compatible: false, reason: 'source' };
  }
  if (allowedTarget && !allowedTarget.includes(targetType)) {
    return { compatible: false, reason: 'target' };
  }
  return { compatible: true };
}

function toContract(row: RelationshipRow): EntityRelationship {
  return {
    id: row.id,
    campaignId: row.campaignId,
    sourceEntityId: row.sourceEntityId,
    targetEntityId: row.targetEntityId,
    relationshipTypeId: row.relationshipTypeId,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Tags aren't fetched for the "other entity" side of a relationship view —
 * the relationship panel doesn't render them, so paying for a join per
 * related entity per query isn't warranted. */
function toEntitySummary(entity: EntityRow): EntitySummary {
  return {
    id: entity.id,
    campaignId: entity.campaignId,
    entityType: entity.entityType,
    name: entity.name,
    slug: entity.slug,
    summary: entity.summary,
    aliases: (entity.aliasesJson as string[] | null) ?? [],
    tags: [],
    status: entity.status,
    visibility: entity.visibility,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
