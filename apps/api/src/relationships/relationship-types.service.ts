import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { EntityType, RelationshipType } from '@worldbinder/contracts';
import type { CreateRelationshipTypeInput } from '@worldbinder/validation';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { relationshipTypes } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { BUILT_IN_RELATIONSHIP_TYPES } from './built-in-relationship-types';

type RelationshipTypeRow = typeof relationshipTypes.$inferSelect;

@Injectable()
export class RelationshipTypesService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
  ) {}

  /** Idempotent and race-safe across the API/worker processes that may both
   * start against a fresh database — rather than a migration-time data
   * seed, since hand-written INSERTs don't belong in a generated schema
   * migration. Conflicts on the primary key (each built-in has a fixed
   * `id`): `key`'s own uniqueness is only a *partial* index scoped to
   * built-ins, and Postgres can't use a partial index as an `ON CONFLICT`
   * arbiter without repeating its predicate, so the primary key is the
   * simpler, robust target here. */
  async onModuleInit(): Promise<void> {
    await this.db
      .insert(relationshipTypes)
      .values(BUILT_IN_RELATIONSHIP_TYPES)
      .onConflictDoNothing({ target: relationshipTypes.id });
  }

  async listForCampaign(campaignId: string): Promise<RelationshipType[]> {
    const rows = await this.db
      .select()
      .from(relationshipTypes)
      .where(
        or(
          isNull(relationshipTypes.campaignId),
          eq(relationshipTypes.campaignId, campaignId),
        ),
      )
      .orderBy(relationshipTypes.forwardLabel);

    return rows.map(toContract);
  }

  async createCustom(
    campaignId: string,
    membership: CampaignMembership,
    input: CreateRelationshipTypeInput,
  ): Promise<RelationshipType> {
    this.assertCanEdit(membership);

    try {
      const [row] = await this.db
        .insert(relationshipTypes)
        .values({
          campaignId,
          key: input.key,
          forwardLabel: input.forwardLabel,
          reverseLabel: input.reverseLabel,
          allowedSourceTypesJson: input.allowedSourceTypes ?? null,
          allowedTargetTypesJson: input.allowedTargetTypes ?? null,
          symmetric: input.symmetric ?? false,
          allowDuplicates: input.allowDuplicates ?? false,
          defaultVisibility: input.defaultVisibility ?? 'public',
        })
        .returning();

      if (!row) throw new Error('Failed to create relationship type');
      return toContract(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A relationship type with this key already exists in this campaign',
        );
      }
      throw error;
    }
  }

  async requireById(
    campaignId: string,
    relationshipTypeId: string,
  ): Promise<RelationshipTypeRow> {
    const [row] = await this.db
      .select()
      .from(relationshipTypes)
      .where(
        and(
          eq(relationshipTypes.id, relationshipTypeId),
          or(
            isNull(relationshipTypes.campaignId),
            eq(relationshipTypes.campaignId, campaignId),
          ),
        ),
      );
    if (!row) throw new NotFoundException('Relationship type not found');
    return row;
  }

  private assertCanEdit(membership: CampaignMembership): void {
    if (!this.policy.canEditEntities(membership.role)) {
      throw new ForbiddenException(
        'You cannot manage relationship types in this campaign',
      );
    }
  }
}

function toContract(row: RelationshipTypeRow): RelationshipType {
  return {
    id: row.id,
    campaignId: row.campaignId,
    key: row.key,
    forwardLabel: row.forwardLabel,
    reverseLabel: row.reverseLabel,
    allowedSourceTypes:
      (row.allowedSourceTypesJson as EntityType[] | null) ?? null,
    allowedTargetTypes:
      (row.allowedTargetTypesJson as EntityType[] | null) ?? null,
    symmetric: row.symmetric,
    allowDuplicates: row.allowDuplicates,
    defaultVisibility: row.defaultVisibility,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  // drizzle-orm >=0.4x wraps the driver error in a DrizzleQueryError, with
  // the original pg error (carrying the real Postgres error `code`) on
  // `.cause` rather than on the thrown error itself.
  return 'cause' in error && isUniqueViolation(error.cause);
}
