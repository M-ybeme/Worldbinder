import type { EntityType } from '@worldbinder/contracts';
import type { relationshipTypes } from '../database/schema';

type BuiltInRelationshipType = Pick<
  typeof relationshipTypes.$inferInsert,
  'id' | 'key' | 'forwardLabel' | 'reverseLabel' | 'symmetric'
> & { allowedTargetTypesJson?: EntityType[] };

/**
 * The 14 relationship types every campaign gets for free, provisioned by
 * `RelationshipTypesService.onModuleInit`. `campaign_id` is left `null` on
 * all of these — that's what marks a row as built-in (roadmap §9.5).
 *
 * Each has a fixed `id` so provisioning can `onConflictDoNothing` against
 * the primary key. `key` also has a uniqueness guarantee, but only via a
 * *partial* unique index (`WHERE campaign_id IS NULL` — see schema.ts) since
 * custom per-campaign types share the same column; Postgres can't use a
 * partial index as an `ON CONFLICT` arbiter without repeating its exact
 * predicate, which makes the primary key the more robust conflict target
 * for an idempotent bulk upsert.
 */
export const BUILT_IN_RELATIONSHIP_TYPES: BuiltInRelationshipType[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    key: 'ally_of',
    forwardLabel: 'Ally of',
    reverseLabel: 'Ally of',
    symmetric: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    key: 'enemy_of',
    forwardLabel: 'Enemy of',
    reverseLabel: 'Enemy of',
    symmetric: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    key: 'rival_of',
    forwardLabel: 'Rival of',
    reverseLabel: 'Rival of',
    symmetric: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    key: 'married_to',
    forwardLabel: 'Married to',
    reverseLabel: 'Married to',
    symmetric: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    key: 'sibling_of',
    forwardLabel: 'Sibling of',
    reverseLabel: 'Sibling of',
    symmetric: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    key: 'parent_of',
    forwardLabel: 'Parent of',
    reverseLabel: 'Child of',
    symmetric: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    key: 'mentor_of',
    forwardLabel: 'Mentor of',
    reverseLabel: 'Student of',
    symmetric: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    key: 'member_of',
    forwardLabel: 'Member of',
    reverseLabel: 'Has member',
    symmetric: false,
    allowedTargetTypesJson: ['faction', 'organization'],
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    key: 'leader_of',
    forwardLabel: 'Leader of',
    reverseLabel: 'Led by',
    symmetric: false,
    allowedTargetTypesJson: ['faction', 'organization'],
  },
  {
    id: '00000000-0000-0000-0000-000000000010',
    key: 'owns',
    forwardLabel: 'Owns',
    reverseLabel: 'Owned by',
    symmetric: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    key: 'located_in',
    forwardLabel: 'Located in',
    reverseLabel: 'Contains',
    symmetric: false,
    allowedTargetTypesJson: ['location'],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    key: 'controls',
    forwardLabel: 'Controls',
    reverseLabel: 'Controlled by',
    symmetric: false,
    allowedTargetTypesJson: ['location', 'faction', 'organization'],
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    key: 'employed_by',
    forwardLabel: 'Employed by',
    reverseLabel: 'Employer of',
    symmetric: false,
    allowedTargetTypesJson: ['character', 'faction', 'organization'],
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    key: 'worships',
    forwardLabel: 'Worships',
    reverseLabel: 'Worshipped by',
    symmetric: false,
    allowedTargetTypesJson: ['deity'],
  },
];
