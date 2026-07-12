import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['active', 'deactivated']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenFamilyId: uuid('token_family_id').notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  userAgentSummary: text('user_agent_summary'),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const securityEventTypeEnum = pgEnum('security_event_type', [
  'user_registered',
  'email_verified',
  'login_succeeded',
  'login_failed',
  'password_changed',
  'password_reset_requested',
  'password_reset_completed',
  'session_revoked',
  'refresh_reuse_detected',
  'account_deactivated',
]);

export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: securityEventTypeEnum('type').notNull(),
  metadataJson: jsonb('metadata_json'),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'hiatus',
  'completed',
  'archived',
]);

export const campaignRoleEnum = pgEnum('campaign_role', [
  'owner',
  'gm',
  'editor',
  'player',
  'viewer',
]);

export const campaignMemberStatusEnum = pgEnum('campaign_member_status', [
  'active',
  'removed',
]);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  systemName: text('system_name'),
  status: campaignStatusEnum('status').notNull().default('draft'),
  coverAttachmentId: uuid('cover_attachment_id'),
  currentWorldDateJson: jsonb('current_world_date_json'),
  settingsJson: jsonb('settings_json'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const campaignMembers = pgTable(
  'campaign_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: campaignRoleEnum('role').notNull(),
    editorSecretAccess: boolean('editor_secret_access')
      .notNull()
      .default(false),
    status: campaignMemberStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.campaignId, table.userId)],
);

export const campaignInvitations = pgTable('campaign_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: campaignRoleEnum('role').notNull(),
  tokenHash: text('token_hash').notNull(),
  invitedByUserId: uuid('invited_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const entityTypeEnum = pgEnum('entity_type', [
  'character',
  'location',
  'faction',
  'organization',
  'item',
  'deity',
  'creature',
  'event',
  'quest',
  'lore',
  'custom',
]);

export const entityStatusEnum = pgEnum('entity_status', [
  'draft',
  'published',
  'archived',
]);

export const entityVisibilityEnum = pgEnum('entity_visibility', [
  'public',
  'gm_only',
]);

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    entityType: entityTypeEnum('entity_type').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    aliasesJson: jsonb('aliases_json'),
    publicContentJson: jsonb('public_content_json'),
    gmContentJson: jsonb('gm_content_json'),
    metadataJson: jsonb('metadata_json'),
    status: entityStatusEnum('status').notNull().default('draft'),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [unique().on(table.campaignId, table.slug)],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.campaignId, table.normalizedName)],
);

export const entityTags = pgTable(
  'entity_tags',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.entityId, table.tagId)],
);

export const relationshipTypes = pgTable(
  'relationship_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable: built-in types have no owning campaign and are shared
    // across all campaigns. Custom types belong to exactly one campaign.
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    forwardLabel: text('forward_label').notNull(),
    reverseLabel: text('reverse_label').notNull(),
    allowedSourceTypesJson: jsonb('allowed_source_types_json'),
    allowedTargetTypesJson: jsonb('allowed_target_types_json'),
    symmetric: boolean('symmetric').notNull().default(false),
    allowDuplicates: boolean('allow_duplicates').notNull().default(false),
    defaultVisibility: entityVisibilityEnum('default_visibility')
      .notNull()
      .default('public'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Postgres treats every NULL as distinct in an ordinary unique
    // constraint, so a single unique(campaign_id, key) would not stop two
    // built-in rows (campaign_id null) from sharing a key. Two partial
    // indexes enforce the intended scoping instead.
    uniqueIndex('relationship_types_builtin_key_idx')
      .on(table.key)
      .where(sql`${table.campaignId} is null`),
    uniqueIndex('relationship_types_campaign_key_idx')
      .on(table.campaignId, table.key)
      .where(sql`${table.campaignId} is not null`),
  ],
);

export const entityRelationships = pgTable('entity_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  sourceEntityId: uuid('source_entity_id')
    .notNull()
    .references(() => entities.id, { onDelete: 'cascade' }),
  targetEntityId: uuid('target_entity_id')
    .notNull()
    .references(() => entities.id, { onDelete: 'cascade' }),
  relationshipTypeId: uuid('relationship_type_id')
    .notNull()
    .references(() => relationshipTypes.id, { onDelete: 'cascade' }),
  description: text('description'),
  visibility: entityVisibilityEnum('visibility').notNull().default('public'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const wikiLinkSectionEnum = pgEnum('wiki_link_section', [
  'public',
  'gm',
]);

export const entityWikiLinks = pgTable('entity_wiki_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  // Only 'entity' exists as a source today; sessions/plot-threads will add
  // more resource types in later milestones, hence a plain text column
  // rather than an enum tied to today's single value.
  sourceResourceType: text('source_resource_type').notNull(),
  sourceResourceId: uuid('source_resource_id').notNull(),
  sourceSection: wikiLinkSectionEnum('source_section').notNull(),
  targetEntityId: uuid('target_entity_id')
    .notNull()
    .references(() => entities.id, { onDelete: 'cascade' }),
  displayText: text('display_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionStatusEnum = pgEnum('session_status', [
  'planned',
  'in_progress',
  'completed',
  'cancelled',
]);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sessionNumber: integer('session_number').notNull(),
    title: text('title').notNull(),
    status: sessionStatusEnum('status').notNull().default('planned'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    playedAt: timestamp('played_at', { withTimezone: true }),
    worldStartDateJson: jsonb('world_start_date_json'),
    worldEndDateJson: jsonb('world_end_date_json'),
    // GM prep notes — never player-facing regardless of session status,
    // gated the same way as gmContentJson.
    plannedContentJson: jsonb('planned_content_json'),
    recapContentJson: jsonb('recap_content_json'),
    gmContentJson: jsonb('gm_content_json'),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [unique().on(table.campaignId, table.sessionNumber)],
);

export const sessionParticipants = pgTable(
  'session_participants',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    campaignMemberId: uuid('campaign_member_id')
      .notNull()
      .references(() => campaignMembers.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.sessionId, table.campaignMemberId)],
);

export const sessionEntities = pgTable(
  'session_entities',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.sessionId, table.entityId)],
);

// Kept as its own table rather than folded into session_entities (which
// featured entity of any type belongs in) — locations "visited" are a
// distinct concept the UI renders separately (roadmap §9.7/ui-ux.md).
// Service layer enforces entityType === 'location' on insert.
export const sessionLocations = pgTable(
  'session_locations',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.sessionId, table.entityId)],
);

// An audit trail ("this entity's visibility flipped from gm_only to public
// during this session"), not just a link — hence its own id/timestamp
// rather than the composite-key shape of the other session join tables.
export const sessionReveals = pgTable(
  'session_reveals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.sessionId, table.entityId)],
);
