import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  customType,
  doublePrecision,
  index,
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

// No native tsvector column type in drizzle-orm; `pg_trgm`/GIN indexes on
// these columns require a hand-added `CREATE EXTENSION IF NOT EXISTS
// pg_trgm;` in the generated migration (drizzle-kit cannot emit extension
// statements from schema.ts) — see CHANGELOG.md for the milestone this was
// introduced in.
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

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
  // FK added in Milestone 9 once the attachments table exists — this column
  // was an unconstrained stub since Milestone 2.
  coverAttachmentId: uuid('cover_attachment_id').references(
    (): AnyPgColumn => attachments.id,
    { onDelete: 'set null' },
  ),
  currentWorldDateJson: jsonb('current_world_date_json'),
  // Milestone 11 ("Timeline and Calendar") — null means
  // DEFAULT_CALENDAR_CONFIG (packages/validation/src/calendar.ts) applies.
  // Lives directly on campaigns (one config per campaign), mirroring
  // currentWorldDateJson/coverAttachmentId rather than a separate table.
  calendarConfigJson: jsonb('calendar_config_json'),
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
    // Search (Milestone 7): searchVectorPublic covers name/aliases/tags/
    // summary/publicContentJson; searchVectorGm additionally includes
    // gmContentJson. Two separate columns, not one gated at query time, so
    // a non-GM search query can never match against secret text — matches
    // this codebase's existing field-omission stance on gmContentJson.
    // Row-level `visibility` above is a separate, still-mandatory filter;
    // these columns only gate content *within* an otherwise-visible row.
    searchVectorPublic: tsvector('search_vector_public'),
    searchVectorGm: tsvector('search_vector_gm'),
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
  (table) => [
    unique().on(table.campaignId, table.slug),
    index('entities_campaign_id_idx').on(table.campaignId),
    index('entities_search_vector_public_idx').using(
      'gin',
      table.searchVectorPublic,
    ),
    index('entities_search_vector_gm_idx').using('gin', table.searchVectorGm),
    // Requires pg_trgm (see the tsvector customType comment above).
    index('entities_name_trgm_idx').using(
      'gin',
      sql`${table.name} gin_trgm_ops`,
    ),
  ],
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

export const entityRelationships = pgTable(
  'entity_relationships',
  {
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
    // Search (Milestone 7): weight D, description only — no public/gm split
    // exists on this table, so a single column is enough here.
    searchVector: tsvector('search_vector'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('entity_relationships_campaign_id_idx').on(table.campaignId),
    index('entity_relationships_search_vector_idx').using(
      'gin',
      table.searchVector,
    ),
  ],
);

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
    // Search (Milestone 7): searchVectorPublic covers title/recapContentJson;
    // searchVectorGm additionally includes plannedContentJson/gmContentJson.
    // Same two-column rationale as entities above.
    searchVectorPublic: tsvector('search_vector_public'),
    searchVectorGm: tsvector('search_vector_gm'),
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
  (table) => [
    unique().on(table.campaignId, table.sessionNumber),
    index('sessions_campaign_id_idx').on(table.campaignId),
    index('sessions_search_vector_public_idx').using(
      'gin',
      table.searchVectorPublic,
    ),
    index('sessions_search_vector_gm_idx').using('gin', table.searchVectorGm),
    index('sessions_title_trgm_idx').using(
      'gin',
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
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

export const plotThreadStatusEnum = pgEnum('plot_thread_status', [
  'foreshadowed',
  'active',
  'dormant',
  'resolved',
  'abandoned',
]);

export const plotThreadImportanceEnum = pgEnum('plot_thread_importance', [
  'minor',
  'standard',
  'major',
  'critical',
]);

export const plotThreads = pgTable(
  'plot_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    publicContentJson: jsonb('public_content_json'),
    gmContentJson: jsonb('gm_content_json'),
    status: plotThreadStatusEnum('status').notNull().default('foreshadowed'),
    importance: plotThreadImportanceEnum('importance')
      .notNull()
      .default('standard'),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    // Search (Milestone 7): searchVectorPublic covers title/summary/
    // publicContentJson; searchVectorGm additionally includes gmContentJson.
    // Same two-column rationale as entities above.
    searchVectorPublic: tsvector('search_vector_public'),
    searchVectorGm: tsvector('search_vector_gm'),
    // Denormalized cache, not the source of truth — the full per-session
    // timeline (with action) lives in session_plot_threads and is only
    // joined on the thread detail view. These let the thread list and
    // dashboard compute "last referenced"/dormancy without an N-row join.
    introducedSessionId: uuid('introduced_session_id').references(
      () => sessions.id,
      { onDelete: 'set null' },
    ),
    lastReferencedSessionId: uuid('last_referenced_session_id').references(
      () => sessions.id,
      { onDelete: 'set null' },
    ),
    resolvedSessionId: uuid('resolved_session_id').references(
      () => sessions.id,
      { onDelete: 'set null' },
    ),
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
  (table) => [
    index('plot_threads_campaign_id_idx').on(table.campaignId),
    index('plot_threads_search_vector_public_idx').using(
      'gin',
      table.searchVectorPublic,
    ),
    index('plot_threads_search_vector_gm_idx').using(
      'gin',
      table.searchVectorGm,
    ),
    index('plot_threads_title_trgm_idx').using(
      'gin',
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
);

export const plotThreadEntities = pgTable(
  'plot_thread_entities',
  {
    plotThreadId: uuid('plot_thread_id')
      .notNull()
      .references(() => plotThreads.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.plotThreadId, table.entityId)],
);

export const plotThreadSessionActionEnum = pgEnum(
  'plot_thread_session_action',
  ['introduced', 'advanced', 'resolved'],
);

export const sessionPlotThreads = pgTable(
  'session_plot_threads',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    plotThreadId: uuid('plot_thread_id')
      .notNull()
      .references(() => plotThreads.id, { onDelete: 'cascade' }),
    action: plotThreadSessionActionEnum('action').notNull(),
  },
  (table) => [unique().on(table.sessionId, table.plotThreadId)],
);

// Milestone 8 — Revisions. Only entities/sessions/plot_threads are
// revisioned (long-form content with a public/GM split); relationships are
// small structured links, excluded by design (see CHANGELOG).
export const resourceRevisionTypeEnum = pgEnum('resource_revision_type', [
  'entity',
  'session',
  'plot_thread',
]);

export const resourceRevisions = pgTable(
  'resource_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    resourceType: resourceRevisionTypeEnum('resource_type').notNull(),
    // No FK: polymorphic across three source tables, same shape as
    // securityEvents/campaignAuditEvents' unconstrained target ids.
    resourceId: uuid('resource_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    // Always the full GM-inclusive shape, regardless of who triggered the
    // write — field-omission for non-GM viewers happens at read time
    // (RevisionsService.list()), not by storing two snapshot variants.
    snapshotJson: jsonb('snapshot_json').notNull(),
    changeSummary: text('change_summary'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('resource_revisions_lookup_idx').on(
      table.campaignId,
      table.resourceType,
      table.resourceId,
      table.revisionNumber,
    ),
  ],
);

// Milestone 8 — campaign-scoped audit/activity log. Deliberately separate
// from securityEvents (apps/api/src/audit/audit.service.ts), which is
// auth-only (global, not campaign-scoped) and stays untouched.
export const campaignAuditEventTypeEnum = pgEnum('campaign_audit_event_type', [
  'member_role_changed',
  'member_removed',
  'content_revealed',
  'revision_restored',
  'campaign_archived',
  'campaign_deleted',
  'destructive_action',
]);

export const campaignAuditEvents = pgTable(
  'campaign_audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    type: campaignAuditEventTypeEnum('type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // No FK: polymorphic target (a member, an entity, a session...).
    targetResourceType: text('target_resource_type'),
    targetResourceId: uuid('target_resource_id'),
    // Structured details only — never content bodies (roadmap §11.14).
    metadataJson: jsonb('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('campaign_audit_events_campaign_idx').on(
      table.campaignId,
      table.createdAt,
    ),
  ],
);

// Milestone 9 — Attachments. Presigned uploads to S3-compatible storage,
// verified server-side by the worker (magic-byte detection, hashing, image
// dimensions) before becoming Ready.
export const attachmentStatusEnum = pgEnum('attachment_status', [
  'pending',
  'uploaded',
  'processing',
  'ready',
  'rejected',
  'deleted',
]);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    // Nullable + set null (not entities.createdByUserId's notNull+cascade
    // pattern): if this cascaded and a user row were hard-deleted, Postgres
    // would delete the attachment row at the FK level with no application
    // code running, so the cleanup job would never fire and the underlying
    // storage object would become permanently unreachable garbage.
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Opaque (`attachments/{campaignId}/{attachmentId}`) — never derived
    // from the client-supplied filename (roadmap §16.2 "keep storage keys
    // opaque"). originalFilename below is display-only.
    storageKey: text('storage_key').notNull().unique(),
    originalFilename: text('original_filename').notNull(),
    // Declared at presign time; overwritten with the worker's real
    // magic-byte-detected value once processed. Never trusted for
    // authorization until then.
    detectedMimeType: text('detected_mime_type'),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    status: attachmentStatusEnum('status').notNull().default('pending'),
    // Only consulted for attachments with no resource_attachments link yet
    // (e.g. a campaign cover image) — see AttachmentsService doc comment.
    // Schema-complete but not enforced by any read path in Milestone 9.
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('attachments_campaign_id_idx').on(table.campaignId),
    // Backs the cleanup sweep's scan for stuck pending/uploaded/processing rows.
    index('attachments_status_idx').on(table.status),
  ],
);

export const resourceAttachments = pgTable(
  'resource_attachments',
  {
    attachmentId: uuid('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'cascade' }),
    // Plain text, not resourceRevisionTypeEnum reused or a new enum: same
    // "more resource types expected later" reasoning as
    // entityWikiLinks.sourceResourceType — an enum here would create a
    // DB-level coupling between two otherwise-unrelated features.
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    caption: text('caption'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.attachmentId, table.resourceType, table.resourceId),
    index('resource_attachments_resource_idx').on(
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const maps = pgTable(
  'maps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    // Direct reference, not a resource_attachments join — one map has at
    // most one background image, same shape as campaigns.coverAttachmentId.
    imageAttachmentId: uuid('image_attachment_id').references(
      () => attachments.id,
      { onDelete: 'set null' },
    ),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No deletedAt (roadmap §9.12's literal column list) — maps hard-delete,
    // unlike entities/sessions/plot_threads. Deleting cascades to layers/pins.
  },
  (table) => [index('maps_campaign_id_idx').on(table.campaignId)],
);

export const mapLayers = pgTable(
  'map_layers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    // No timestamps — §9.12's literal column list omits them for this table.
  },
  (table) => [index('map_layers_map_id_idx').on(table.mapId)],
);

export const mapPins = pgTable(
  'map_pins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    // Nullable + set null: deleting a layer ungroups its pins rather than
    // deleting them — layers are an optional organizational feature.
    layerId: uuid('layer_id').references(() => mapLayers.id, {
      onDelete: 'set null',
    }),
    // Column name describes "the location on the map," not a type
    // constraint — accepts any entity type (Character/Faction/Event/Quest/
    // Location per ui-ux.md), unlike session_locations' service-enforced
    // entityType === 'location' narrowing. Nullable: a pin can be a
    // freestanding labeled marker with no entity link.
    locationEntityId: uuid('location_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    label: text('label'),
    // Normalized 0-1 so pins stay positioned across responsive image sizes
    // (roadmap §9.12).
    xNormalized: doublePrecision('x_normalized').notNull(),
    yNormalized: doublePrecision('y_normalized').notNull(),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('map_pins_map_id_idx').on(table.mapId),
    index('map_pins_layer_id_idx').on(table.layerId),
    index('map_pins_location_entity_id_idx').on(table.locationEntityId),
  ],
);

// Milestone 11 — Timeline and Calendar.

export const timelineDatePrecisionEnum = pgEnum('timeline_date_precision', [
  'year',
  'month',
  'day',
]);

export const timelineEvents = pgTable(
  'timeline_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    contentJson: jsonb('content_json'),
    // Null together (roadmap §9.13) — an event with no date lives in the
    // "Undated" section. datePrecision dictates which of year/month/day
    // startDateJson/endDateJson actually carry; see
    // packages/validation/src/calendar.ts's TimelineDate/isValidTimelineDate.
    startDateJson: jsonb('start_date_json'),
    endDateJson: jsonb('end_date_json'),
    datePrecision: timelineDatePrecisionEnum('date_precision'),
    visibility: entityVisibilityEnum('visibility').notNull().default('public'),
    // Single column, not entities'/sessions' two-tier public/gm split —
    // timeline events have no separate GM-only sub-content, only a
    // row-level visibility (like maps), so one vector suffices.
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No deletedAt (roadmap §9.13's literal column list, matching maps'
    // precedent) — timeline events hard-delete, no revision history.
  },
  (table) => [
    index('timeline_events_campaign_id_idx').on(table.campaignId),
    index('timeline_events_search_vector_idx').using('gin', table.searchVector),
  ],
);

export const timelineEventEntities = pgTable(
  'timeline_event_entities',
  {
    timelineEventId: uuid('timeline_event_id')
      .notNull()
      .references(() => timelineEvents.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.timelineEventId, table.entityId)],
);

export const timelineEventSessions = pgTable(
  'timeline_event_sessions',
  {
    timelineEventId: uuid('timeline_event_id')
      .notNull()
      .references(() => timelineEvents.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.timelineEventId, table.sessionId)],
);

export const timelineEventTags = pgTable(
  'timeline_event_tags',
  {
    timelineEventId: uuid('timeline_event_id')
      .notNull()
      .references(() => timelineEvents.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.timelineEventId, table.tagId)],
);
