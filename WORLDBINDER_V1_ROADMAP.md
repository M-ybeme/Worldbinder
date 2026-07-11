# Worldbinder v1.0 — Product Roadmap and Architecture Plan

> **Status:** Implementation blueprint  
> **Target:** Public, production-ready v1.0  
> **Primary product:** Permission-aware campaign encyclopedia and continuity manager  
> **Primary technical goal:** Demonstrate professional React, TypeScript, Node/NestJS, PostgreSQL, testing, security, storage, CI/CD, and production operations

---

## 1. Executive Summary

Worldbinder is a campaign continuity and connected-knowledge application for tabletop role-playing games. It allows a game master to model a campaign as a network of characters, locations, factions, organizations, items, events, quests, lore, sessions, secrets, and plot threads.

The defining capability is not note-taking. It is the ability to connect information and retrieve the campaign context surrounding it.

A user should be able to open an entity such as **Duke Renald** and immediately see:

- His description, aliases, portrait, status, and structured character fields
- The faction to which he belongs
- The city he governs
- The sessions in which he appeared
- The plot threads connected to him
- Other pages that mention him
- Information visible to players
- Information visible only to the GM
- The revision history of the page

Worldbinder should sit beside the DM's Toolbox rather than overlap it:

- **DM's Toolbox:** Operates the table during play
- **Worldbinder:** Preserves and organizes the campaign between sessions

The v1 release should be narrow enough to finish but complete enough to be used as a real product. It should include authentication, multi-campaign workspaces, campaign membership and permissions, structured entities, typed relationships, wiki links, backlinks, sessions, plot threads, search, maps, timelines, revisions, attachments, import, export, production monitoring, automated tests, and release documentation.

---

## 2. Product Principles

### 2.1 Campaign knowledge is connected

Worldbinder should treat relationships as first-class data. A campaign is not a folder of isolated notes.

### 2.2 GM secrets must be genuinely protected

Visibility is a backend authorization concern. Hidden content must not be returned to unauthorized clients, included in search results, embedded in previews, or leaked through backlinks.

### 2.3 The product must help during actual play

Search, backlinks, entity summaries, and session history should be optimized for quick retrieval. A technically elaborate feature that takes too long to use at the table is a failed feature.

### 2.4 Users own their campaign data

A complete campaign must be exportable and restorable. The export format should be versioned, documented, and independent of the production database schema.

### 2.5 v1 should be deep, not broad

Do not add dice rolling, combat tracking, character sheets, encounter building, rules content, virtual tabletop combat, voice chat, or random generators. Those dilute the product and duplicate existing tools.

### 2.6 Technology choices must be coherent

The project should broaden the portfolio without looking like a collection of unrelated libraries. Every major technology must solve a real product problem.

---

## 3. v1.0 Product Scope

A release is considered feature-complete when users can perform the following workflows without developer assistance.

### 3.1 Account workflows

- Register an account
- Verify an email address
- Sign in and sign out
- Reset a forgotten password
- View active sessions
- Revoke another session
- Change a password
- Delete or deactivate an account through a documented process

### 3.2 Campaign workflows

- Create multiple campaigns
- Switch between campaigns
- Edit campaign settings
- Archive and restore a campaign
- Invite members
- Assign campaign roles
- Remove members
- Separate GM content from player-visible content

### 3.3 Encyclopedia workflows

- Create structured entries
- Edit rich-text content
- Add tags and aliases
- Add type-specific metadata
- Create typed relationships
- Add wiki links in prose
- View backlinks
- Browse related entities
- Upload images and files
- View revision history
- Restore a previous revision

### 3.4 Session workflows

- Create planned sessions
- Record session preparation
- Record the actual recap
- Link featured entities
- Link locations visited
- Advance or resolve plot threads
- Reveal selected information
- Mark a session complete
- Update the campaign's current in-world date

### 3.5 Continuity workflows

- Track plot threads
- Mark threads foreshadowed, active, dormant, resolved, or abandoned
- See the last session in which a thread appeared
- Surface neglected threads on the dashboard
- Browse plot threads as a player, read-only, with player-facing status labels and only authorized fields/connections (see §5.4 and §9.8)
- Search across the campaign
- Browse in-world history on a timeline, nested under World rather than a top-level nav destination (see §10.1)
- Browse locations on uploaded maps

### 3.6 Ownership workflows

- Export a complete campaign
- Validate an export archive
- Import an archive into a new campaign
- Preserve links, attachments, relationships, and visibility settings
- Receive a dry-run import report before data is written

---

## 4. Explicit Non-Goals for v1.0

These features should not enter the v1 scope:

- AI-generated campaign content
- Chat with campaign data
- Semantic/vector search
- Live simultaneous rich-text editing
- Native mobile applications
- Public marketplace
- Paid plans or billing
- Public campaign browsing
- System-specific rules databases
- Character sheet automation
- Initiative or encounter management
- Dice rolling
- Tactical battle maps
- Fog of war
- Procedural map generation
- Audio/video/chat
- Full offline multi-device synchronization
- Graph database infrastructure

The architecture may leave room for later additions, but no v1 milestone should depend on them.

---

## 5. Target Users and Roles

### 5.1 Owner

The campaign owner has full control, including campaign deletion, member management, exports, settings, and ownership transfer.

### 5.2 Game Master

A GM can view and edit hidden content, manage most campaign data, create sessions, reveal information, and manage players. A GM cannot delete the campaign or transfer ownership unless explicitly granted later.

### 5.3 Editor

An editor can maintain encyclopedia data, sessions, and plot threads but does not automatically gain access to all secrets. The owner or GM can configure whether editors may see GM-only sections.

### 5.4 Player

A player can view information revealed to them, including read-only access to plot threads that are visible to them — the thread list stays in player navigation, but the API returns only authorized public fields (public title, public summary, player-facing status, known connected entities, revealed session history, public resolution) and omits GM-only fields (GM notes, planned developments, hidden relationships, unrevealed entities, internal status values) entirely rather than nulling them out. See `docs/planning/ui-ux.md` for the full breakdown and §9.8 for the status projection this implies. Optional campaign settings may allow player-created notes, comments, or private observations, but this is not required for the first beta.

### 5.5 Viewer

A viewer has read-only access to campaign-visible information. This role is useful for guests or spectators.

### 5.6 Permission matrix

| Capability             | Owner |      GM |       Editor |   Player | Viewer |
| ---------------------- | ----: | ------: | -----------: | -------: | -----: |
| Edit campaign settings |   Yes | Limited |           No |       No |     No |
| Invite/remove members  |   Yes |     Yes |           No |       No |     No |
| Change roles           |   Yes | Limited |           No |       No |     No |
| View GM-only content   |   Yes |     Yes | Configurable |       No |     No |
| Create/edit entities   |   Yes |     Yes |          Yes | Optional |     No |
| Create/edit sessions   |   Yes |     Yes |          Yes |       No |     No |
| Manage plot threads    |   Yes |     Yes |          Yes |       No |     No |
| View visible threads   |   Yes |     Yes |          Yes |      Yes |    Yes |
| Reveal content         |   Yes |     Yes |           No |       No |     No |
| Export campaign        |   Yes |     Yes | Configurable |       No |     No |
| Archive campaign       |   Yes |     Yes |           No |       No |     No |
| Delete campaign        |   Yes |      No |           No |       No |     No |

The API must make the final permission decision. UI checks exist only to improve usability.

---

## 6. Recommended Technology Stack

The project should use supported production releases rather than experimental release lines. Node's own guidance is to deploy production applications on Active LTS or Maintenance LTS versions. At implementation time, pin the exact versions in the lockfile and document upgrade decisions in release notes.

### 6.1 Runtime and language

- **Node.js:** Active LTS release
- **TypeScript:** Strict mode enabled across all packages
- **Package manager:** pnpm
- **Monorepo orchestration:** Turborepo

### 6.2 Frontend

- **React 19.x**
- **Vite**
- **React Router**
- **TanStack Query** for server state
- **Zustand** for small amounts of client-only state
- **React Hook Form** for form state
- **Zod** for runtime validation and shared contracts
- **TipTap** for rich-text editing
- **Tailwind CSS** with a small internal component system
- **Vitest**
- **React Testing Library**
- **Playwright**
- **MSW** for isolated API mocking where appropriate

### 6.3 Backend

- **NestJS 11.x or the current supported major when implementation begins**
- **Drizzle ORM**
- **PostgreSQL**
- **Redis** for rate limiting, short-lived coordination, cache invalidation, and jobs
- **Pino** for structured logging
- **OpenAPI** generated from NestJS metadata
- **Argon2id** for password hashing
- **JWT access tokens** plus rotating refresh-token sessions
- **BullMQ** for export, import, attachment processing, and cleanup jobs
- **Supertest** for API integration tests

### 6.4 Storage and infrastructure

- **Docker Compose** for local development
- **MinIO** for local S3-compatible storage
- **Cloudflare R2** or AWS S3 in production
- **Mailpit** locally
- **Postmark, Resend, or SES** in production
- **GitHub Actions** for CI/CD
- **Sentry** for frontend and backend errors
- **OpenTelemetry** for traces and service metrics
- **Managed PostgreSQL** in production
- **Managed Redis** in production

### 6.5 Why this stack

This stack demonstrates:

- Professional React application architecture
- TypeScript across browser and server
- Node backend development
- Dependency injection and modular server design
- SQL and relational modeling
- Complex authorization
- Rich-text document modeling
- Object storage
- Background jobs
- CI/CD
- Integration and end-to-end testing
- Production observability

It is materially different from the user's existing .NET and Blazor portfolio while remaining internally coherent.

---

## 7. Repository Structure

```text
worldbinder/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── routes/
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   └── test/
│   │   └── package.json
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── campaigns/
│       │   ├── memberships/
│       │   ├── entities/
│       │   ├── relationships/
│       │   ├── wiki-links/
│       │   ├── sessions/
│       │   ├── plot-threads/
│       │   ├── maps/
│       │   ├── timeline/
│       │   ├── search/
│       │   ├── revisions/
│       │   ├── attachments/
│       │   ├── imports/
│       │   ├── exports/
│       │   ├── audit/
│       │   ├── jobs/
│       │   ├── database/
│       │   └── common/
│       └── package.json
├── packages/
│   ├── contracts/
│   ├── validation/
│   ├── ui/
│   ├── config/
│   ├── eslint-config/
│   └── tsconfig/
├── infrastructure/
│   ├── docker/
│   ├── compose/
│   ├── migrations/
│   ├── seed/
│   └── scripts/
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── product/
│   ├── runbooks/
│   ├── security/
│   └── testing/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 7.1 Package boundaries

#### `packages/contracts`

Public request, response, pagination, error, and event contracts. Database row types must not be exported from this package.

#### `packages/validation`

Shared Zod schemas that are safe to execute in both frontend and backend contexts.

#### `packages/ui`

Reusable visual primitives. Build this gradually from real product needs rather than creating a large abstract design system before workflows exist.

#### `packages/config`

Environment parsing, feature flags, logging defaults, and shared build configuration.

---

## 8. Architectural Style

### 8.1 Modular monolith

Worldbinder v1 should be a modular monolith, not a microservice system.

The API will deploy as one NestJS application with clearly separated modules. Background workers may run as a second process using the same codebase and database, but this does not make them independent services.

Benefits:

- Easier local development
- Simpler transactions
- Lower deployment complexity
- Clear domain boundaries
- Straightforward extraction later if a module becomes operationally independent

### 8.2 REST API

Use REST for v1 because the domain maps cleanly to resources and because OpenAPI documentation, HTTP caching, permission testing, and conventional monitoring are straightforward.

Do not introduce GraphQL unless actual product requirements later justify client-selected nested queries.

### 8.3 Campaign-scoped multitenancy

Every campaign-owned row must contain a `campaign_id` or inherit campaign ownership through a strict foreign-key chain. Every repository query should be scoped by campaign whenever practical.

Never accept a resource ID and assume campaign membership solely because the resource exists.

### 8.4 Domain services

Controllers should handle transport concerns. Services should handle orchestration and policy. Repository functions should handle persistence. Cross-cutting authorization belongs in guards and policy services, not scattered conditionals.

---

## 9. Core Data Model

Use UUIDs for external identifiers. Store timestamps in UTC. Use `created_at`, `updated_at`, and optional `deleted_at` consistently.

### 9.1 Users and authentication

#### `users`

- `id`
- `email`
- `display_name`
- `email_verified_at`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

#### `user_credentials`

- `user_id`
- `password_hash`
- `password_changed_at`

#### `user_sessions`

- `id`
- `user_id`
- `token_family_id`
- `refresh_token_hash`
- `user_agent_summary`
- `ip_hash` or privacy-reduced network metadata
- `created_at`
- `last_used_at`
- `expires_at`
- `revoked_at`

#### Token tables

- Email verification tokens
- Password reset tokens
- Campaign invitation tokens

Only token hashes should be stored.

### 9.2 Campaigns

#### `campaigns`

- `id`
- `owner_user_id`
- `name`
- `slug`
- `description`
- `system_name`
- `status`
- `cover_attachment_id`
- `current_world_date_json`
- `settings_json`
- `created_at`
- `updated_at`
- `archived_at`
- `deleted_at`

Statuses:

- Draft
- Active
- Hiatus
- Completed
- Archived

#### `campaign_members`

- `id`
- `campaign_id`
- `user_id`
- `role`
- `editor_secret_access`
- `status`
- `created_at`
- `updated_at`

Unique constraint on `(campaign_id, user_id)`.

#### `campaign_invitations`

- `id`
- `campaign_id`
- `email`
- `role`
- `token_hash`
- `invited_by_user_id`
- `expires_at`
- `accepted_at`
- `revoked_at`

### 9.3 Entities

#### `entities`

- `id`
- `campaign_id`
- `entity_type`
- `name`
- `slug`
- `summary`
- `public_content_json`
- `gm_content_json`
- `metadata_json`
- `status`
- `visibility`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`
- `deleted_at`

Core types:

- Character
- Location
- Faction
- Organization
- Item
- Deity
- Creature
- Event
- Quest
- Lore
- Custom

Use JSONB for metadata, but normalize fields that need foreign keys, filtering, sorting, or uniqueness.

#### Type-specific examples

Character metadata:

```json
{
  "aliases": ["The White Wolf"],
  "pronouns": "she/her",
  "species": "Human",
  "occupation": "Knight",
  "lifeStatus": "alive",
  "currentLocationEntityId": "uuid"
}
```

Location metadata:

```json
{
  "locationType": "City",
  "parentLocationEntityId": "uuid",
  "population": 12500,
  "government": "Merchant council"
}
```

Entity metadata schemas must be versioned and validated by entity type.

### 9.4 Tags

#### `tags`

- `id`
- `campaign_id`
- `name`
- `normalized_name`
- `created_at`

#### `entity_tags`

- `entity_id`
- `tag_id`

### 9.5 Relationships

#### `relationship_types`

- `id`
- `campaign_id` nullable for built-in types
- `key`
- `forward_label`
- `reverse_label`
- `allowed_source_types_json`
- `allowed_target_types_json`
- `symmetric`
- `allow_duplicates`
- `default_visibility`

#### `entity_relationships`

- `id`
- `campaign_id`
- `source_entity_id`
- `target_entity_id`
- `relationship_type_id`
- `description`
- `visibility`
- `created_by_user_id`
- `created_at`
- `updated_at`

Do not store a duplicate reverse row. Generate the reverse presentation through query projection.

### 9.6 Wiki links

#### `entity_wiki_links`

- `id`
- `campaign_id`
- `source_resource_type`
- `source_resource_id`
- `source_section`
- `target_entity_id`
- `display_text`
- `created_at`

TipTap should store entity references as structured nodes containing the entity ID. Display names can update without breaking references.

### 9.7 Sessions

#### `sessions`

- `id`
- `campaign_id`
- `session_number`
- `title`
- `status`
- `scheduled_at`
- `played_at`
- `world_start_date_json`
- `world_end_date_json`
- `planned_content_json`
- `recap_content_json`
- `gm_content_json`
- `visibility`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`
- `deleted_at`

Statuses:

- Planned
- In Progress
- Completed
- Cancelled

Join tables:

- `session_participants`
- `session_entities`
- `session_locations`
- `session_plot_threads`
- `session_reveals`

### 9.8 Plot threads

#### `plot_threads`

- `id`
- `campaign_id`
- `title`
- `summary`
- `public_content_json`
- `gm_content_json`
- `status`
- `importance`
- `visibility`
- `introduced_session_id`
- `last_referenced_session_id`
- `resolved_session_id`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`
- `deleted_at`

Statuses (internal, GM-facing — stored as-is):

- Foreshadowed
- Active
- Dormant
- Resolved
- Abandoned

Importance:

- Minor
- Standard
- Major
- Critical

#### Player-facing status projection

The internal status above is deliberately GM-facing — "Abandoned" or "Dormant" can itself be a spoiler. Players see a smaller, projected set of labels computed from the internal status rather than the raw enum value:

| Internal (GM) | Player-facing                                    |
| ------------- | ------------------------------------------------ |
| Foreshadowed  | Open                                             |
| Active        | Ongoing                                          |
| Dormant       | Ongoing                                          |
| Resolved      | Completed                                        |
| Abandoned     | Open, or hidden entirely depending on visibility |

For v1 this is a pure API-layer projection (no extra column) computed from `status` at response time — not a separate stored field. Revisit only if a GM needs the player-facing label to diverge from a mechanical function of internal status (e.g. resolving a thread internally while it still reads "Ongoing" to players for a specific number of sessions).

### 9.9 Visibility grants

#### `resource_visibility_grants`

- `id`
- `campaign_id`
- `resource_type`
- `resource_id`
- `campaign_member_id`
- `created_at`

Visibility values:

- `GM_ONLY`
- `CAMPAIGN_MEMBERS`
- `SELECTED_MEMBERS`
- `PRIVATE_TO_AUTHOR`

A future `PUBLIC_LINK` value may be added, but it should not be exposed in v1 unless public sharing is fully threat-modeled.

### 9.10 Revisions

#### `resource_revisions`

- `id`
- `campaign_id`
- `resource_type`
- `resource_id`
- `revision_number`
- `snapshot_json`
- `change_summary`
- `created_by_user_id`
- `created_at`

Restoration creates a new revision. Existing revision rows are immutable.

### 9.11 Attachments

#### `attachments`

- `id`
- `campaign_id`
- `uploaded_by_user_id`
- `storage_key`
- `original_filename`
- `detected_mime_type`
- `size_bytes`
- `sha256`
- `width`
- `height`
- `status`
- `visibility`
- `created_at`
- `deleted_at`

#### `resource_attachments`

- `attachment_id`
- `resource_type`
- `resource_id`
- `display_order`
- `caption`

Statuses:

- Pending
- Uploaded
- Processing
- Ready
- Rejected
- Deleted

### 9.12 Maps

#### `maps`

- `id`
- `campaign_id`
- `name`
- `description`
- `image_attachment_id`
- `visibility`
- `created_at`
- `updated_at`

#### `map_layers`

- `id`
- `map_id`
- `name`
- `display_order`
- `visibility`

#### `map_pins`

- `id`
- `map_id`
- `layer_id`
- `location_entity_id`
- `label`
- `x_normalized`
- `y_normalized`
- `visibility`
- `created_at`
- `updated_at`

Coordinates range from 0 to 1 so pins remain positioned across responsive image sizes.

### 9.13 Timeline

#### `timeline_events`

- `id`
- `campaign_id`
- `title`
- `summary`
- `content_json`
- `start_date_json`
- `end_date_json`
- `date_precision`
- `visibility`
- `created_at`
- `updated_at`

Join tables connect events to entities, sessions, and tags.

---

## 10. Frontend Architecture

### 10.1 Route tree

Primary navigation is deliberately small: **Dashboard, World, Sessions, Threads, Maps, Search**, consistent for both GM and player roles (role differences affect content and actions, not navigation structure — see `docs/planning/ui-ux.md`). Timeline and the relationship graph are views _within_ World rather than separate top-level destinations, since they're different lenses on the same campaign knowledge rather than a distinct content domain.

```text
/login
/register
/verify-email
/forgot-password
/reset-password

/app/campaigns
/app/campaign/:campaignId/dashboard
/app/campaign/:campaignId/world
/app/campaign/:campaignId/world/new
/app/campaign/:campaignId/world/:entityId
/app/campaign/:campaignId/world/timeline
/app/campaign/:campaignId/world/relationships
/app/campaign/:campaignId/sessions
/app/campaign/:campaignId/sessions/:sessionId
/app/campaign/:campaignId/threads
/app/campaign/:campaignId/threads/:threadId
/app/campaign/:campaignId/search
/app/campaign/:campaignId/maps
/app/campaign/:campaignId/maps/:mapId
/app/campaign/:campaignId/members
/app/campaign/:campaignId/settings
/app/campaign/:campaignId/import-export

/account/profile
/account/security
/account/sessions
```

Note: `/world` is the product-facing and route-facing name for what earlier sections of this document call the "encyclopedia." The underlying domain module (`apps/api/src/entities`, `entities` table, "Encyclopedia workflows" in §3.3) keeps its existing name — this rename is a navigation/URL decision, not a data-model rename.

### 10.2 State ownership

Use **TanStack Query** for:

- API resources
- Pagination
- Mutation status
- Cache invalidation
- Optimistic updates where rollback is reliable
- Retry and stale-data behavior

Use **Zustand** only for:

- Sidebar state
- Editor-panel state
- Unsaved local drafts
- Search overlay state
- Recently viewed navigation history
- Client-only preferences

Use the URL for:

- Search terms
- Entity filters
- Sort order
- Page/cursor state when shareable
- Selected tabs when deep links are useful

Do not duplicate server-owned data into Zustand.

### 10.3 Feature folders

```text
features/entities/
├── api/
├── components/
├── hooks/
├── pages/
├── schemas/
├── types/
└── utils/
```

Keep feature-specific behavior close together. Generic abstractions should be extracted only after multiple real uses appear.

### 10.4 Rich-text model

TipTap JSON is the canonical content format.

Required nodes and marks:

- Paragraphs
- Headings
- Ordered and unordered lists
- Blockquotes
- Links
- Tables
- Inline code
- Code blocks
- Images
- Entity wiki links
- Entity mentions
- Horizontal rules

Sanitized HTML may be generated for rendering and search extraction, but raw HTML should not be the source of truth.

### 10.5 Autosave and drafts

- Debounce writes after an idle period
- Show `Saving`, `Saved`, `Offline`, and `Save failed`
- Preserve local drafts in IndexedDB
- Warn before navigation when server persistence has failed
- Use an `updatedAt` or version field for optimistic concurrency
- Merge autosave writes into revision windows rather than creating one revision per keystroke

### 10.6 Error handling

- Route-level error boundaries
- Query-level retry only for transient failures
- Clear conflict UI for stale writes
- Toasts for completed background actions
- Inline validation for user-correctable errors
- Trace ID in technical error details

---

## 11. Backend Module Responsibilities

### 11.1 Auth module

- Registration
- Verification
- Login
- Logout
- Refresh rotation
- Password reset
- Password change
- Session list
- Session revocation
- Login throttling
- Security events

### 11.2 Campaign module

- Campaign CRUD
- Archive/restore
- Settings
- Dashboard aggregation
- Owner-only destructive actions
- Current in-world date

### 11.3 Membership module

- Invitations
- Invite acceptance
- Role changes
- Member removal
- Effective permission calculation
- Campaign request context

### 11.4 Entity module

- Type validation
- Entity CRUD
- Metadata validation
- Tags
- Aliases
- Slugs
- Soft deletion
- Revision creation
- Search indexing

### 11.5 Relationship module

- Built-in and custom relationship types
- Source/target compatibility
- Reverse-label projection
- Duplicate prevention
- Symmetric relationship handling
- Neighborhood queries

### 11.6 Wiki-link module

- Extract structured links from editor JSON
- Refresh stored backlinks after content updates
- Report unresolved references
- Protect against cross-campaign links
- Preserve references through renames

### 11.7 Session module

- Session CRUD
- Participant and entity linking
- Recap publication
- Session completion transaction
- Campaign-date update
- Plot-thread advancement
- Secret reveal events

### 11.8 Plot-thread module

- CRUD
- State-transition rules
- Dormancy calculation
- Related resources
- Dashboard summaries

### 11.9 Search module

- PostgreSQL full-text search
- Trigram matching
- Weighted ranking
- Permission filtering
- Search excerpts
- Performance telemetry

### 11.10 Revision module

- Immutable snapshots
- Revision lists
- Diffs
- Restores
- Autosave grouping
- Retention policy

### 11.11 Attachment module

- Presigned uploads
- Completion verification
- MIME detection
- Hashing
- Metadata extraction
- Signed downloads
- Permission enforcement
- Orphan cleanup

### 11.12 Map and timeline modules

- Map CRUD
- Pin/layer CRUD
- Normalized coordinate validation
- Calendar validation
- Timeline ordering
- Visibility filtering

### 11.13 Import/export modules

- Background job orchestration
- Versioned archive format
- Dry runs
- Checksum validation
- ID remapping
- Transactional imports
- Download expiration

### 11.14 Audit module

Record significant events:

- Login and failed login
- Password changes
- Session revocation
- Role changes
- Member removal
- Content reveal
- Revision restore
- Campaign export
- Campaign import
- Destructive actions

Do not store private content bodies in audit logs.

---

## 12. Authentication and Session Design

### 12.1 Token model

- Short-lived access token
- Long-lived rotating refresh token
- Refresh token stored in secure, HTTP-only, same-site cookie
- Refresh token hash stored in database
- Token family used to detect reuse

### 12.2 Refresh flow

1. Client requests refresh.
2. API hashes the supplied token and locates the active session.
3. API rejects expired or revoked sessions.
4. API rotates the refresh token.
5. The previous token becomes invalid.
6. Reuse of the previous token revokes the full family.

### 12.3 Password storage

Use Argon2id with reviewed production parameters. Keep hashing configuration centralized and versioned so parameters can be upgraded on later logins.

### 12.4 Cookie requirements

Production cookies:

- `HttpOnly`
- `Secure`
- `SameSite=Lax` or stricter where deployment topology allows
- Narrow path
- Explicit maximum age

### 12.5 Account recovery

- Store reset token hashes only
- Expire quickly
- Invalidate after use
- Revoke existing sessions after password reset, or give the user an explicit option with a secure default

---

## 13. Authorization Design

Authorization is evaluated through a policy service using:

- User identity
- Campaign membership
- Campaign role
- Resource visibility
- Selected-member grants
- Resource ownership where applicable
- Requested operation

### 13.1 Required rules

- An entity in Campaign A cannot be referenced from Campaign B.
- Search cannot reveal titles or snippets of hidden resources.
- Backlink counts cannot leak hidden references.
- Attachment downloads must resolve the parent resource and visibility.
- Revision history must follow the current resource permission policy.
- Deleted or revoked members lose access immediately.
- Frontend prefetching must not request unauthorized routes.

### 13.2 Field-level filtering

Some resources contain both public and GM-only sections. The API serializer must omit unauthorized fields entirely.

Do not return `gmContent: null` to players if the existence of the field itself carries sensitive meaning in a future workflow. Prefer role-specific response contracts where appropriate.

---

## 14. Search Design

### 14.1 Searchable resources

- Entities
- Sessions
- Plot threads
- Timeline events
- Tags
- Aliases
- Relationship descriptions

### 14.2 PostgreSQL implementation

Use:

- `tsvector` columns
- GIN indexes
- `pg_trgm` for partial and fuzzy name matching
- Weighted fields

Suggested weights:

- Name: A
- Aliases: A
- Summary: B
- Tags: B
- Body content: C
- Relationship text: D

### 14.3 Ranking order

1. Exact name
2. Exact alias
3. Name prefix
4. Fuzzy name
5. Summary/tag match
6. Content match
7. Relationship-description match

### 14.4 Performance target

For a large campaign containing 10,000 entities, 50,000 relationships, 200 sessions, and 2,000 plot threads, normal p95 search latency should remain under 500 ms.

### 14.5 Permission safety

Apply permission predicates within the database query or before any matching snippet is returned. Do not rank hidden rows and remove them after generating excerpts.

---

## 15. Revision and Concurrency Design

### 15.1 Revision rules

- Create revisions for meaningful persisted changes
- Group rapid autosaves into a revision window
- Keep revision snapshots immutable
- Restoration creates a new current version and a new revision
- Track the actor and optional change summary

### 15.2 Concurrency

Every mutable resource should expose a version or `updatedAt` value.

Clients include that value on update. If it is stale:

- Return `409 Conflict`
- Return the current server version metadata
- Preserve the local draft
- Let the user compare or overwrite intentionally

Do not silently apply last-write-wins to long-form campaign content.

---

## 16. Attachment Pipeline

### 16.1 Upload sequence

1. Client requests an upload reservation.
2. API validates campaign permission, declared type, and size.
3. API creates a pending attachment row.
4. API returns a presigned object-storage URL.
5. Client uploads directly to storage.
6. Client calls completion endpoint.
7. Worker retrieves metadata, detects MIME type, calculates hash, and optionally scans.
8. Attachment becomes `Ready` or `Rejected`.

### 16.2 Safety requirements

- Do not trust extension or browser MIME type
- Enforce size limits
- Sanitize filenames for display
- Keep storage keys opaque
- Use short-lived signed download URLs
- Disallow executable and dangerous archive types for v1
- Prevent cross-campaign attachment linking
- Remove abandoned pending uploads

### 16.3 Suggested v1 file support

- PNG
- JPEG
- WebP
- GIF, optionally static-only
- PDF
- Plain text
- Markdown

Avoid arbitrary office documents until previewing and scanning policies are settled.

---

## 17. Import and Export Format

### 17.1 Archive layout

```text
worldbinder-export/
├── manifest.json
├── campaign.json
├── members.json
├── entities.json
├── relationships.json
├── wiki-links.json
├── sessions.json
├── plot-threads.json
├── maps.json
├── timeline.json
├── tags.json
├── attachments/
└── checksums.json
```

Member exports should not include private account data. Export campaign membership labels and roles only when necessary for restoration, with emails omitted by default.

### 17.2 Manifest

```json
{
  "format": "worldbinder-campaign",
  "schemaVersion": "1.0.0",
  "applicationVersion": "1.0.0",
  "exportedAt": "2026-07-10T00:00:00Z",
  "campaignId": "uuid"
}
```

### 17.3 Import sequence

1. Upload archive
2. Validate archive size and file count
3. Reject path traversal and symbolic links
4. Read manifest
5. Validate schema version
6. Verify checksums
7. Validate all JSON documents
8. Produce dry-run report
9. Ask user to confirm
10. Remap IDs
11. Import in a database transaction
12. Upload attachments to new storage keys
13. Commit only after all required records succeed
14. Produce import report

If attachment transfer cannot remain inside the database transaction, stage uploaded files and delete them on rollback.

---

## 18. API Conventions

### 18.1 Response conventions

- JSON
- Cursor pagination for large collections
- ISO 8601 timestamps
- Stable error codes
- OpenAPI documentation
- Request IDs

### 18.2 Error shape

```json
{
  "type": "https://worldbinder.app/errors/resource-forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to view this resource.",
  "code": "RESOURCE_FORBIDDEN",
  "traceId": "uuid"
}
```

### 18.3 Representative routes

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/sessions
DELETE /auth/sessions/:sessionId

GET    /campaigns
POST   /campaigns
GET    /campaigns/:campaignId
PATCH  /campaigns/:campaignId
DELETE /campaigns/:campaignId

GET    /campaigns/:campaignId/members
POST   /campaigns/:campaignId/invitations
PATCH  /campaigns/:campaignId/members/:memberId
DELETE /campaigns/:campaignId/members/:memberId

GET    /campaigns/:campaignId/entities
POST   /campaigns/:campaignId/entities
GET    /campaigns/:campaignId/entities/:entityId
PATCH  /campaigns/:campaignId/entities/:entityId
DELETE /campaigns/:campaignId/entities/:entityId

POST   /campaigns/:campaignId/relationships
PATCH  /campaigns/:campaignId/relationships/:relationshipId
DELETE /campaigns/:campaignId/relationships/:relationshipId

GET    /campaigns/:campaignId/sessions
POST   /campaigns/:campaignId/sessions
GET    /campaigns/:campaignId/sessions/:sessionId
PATCH  /campaigns/:campaignId/sessions/:sessionId
POST   /campaigns/:campaignId/sessions/:sessionId/complete

GET    /campaigns/:campaignId/plot-threads
POST   /campaigns/:campaignId/plot-threads
PATCH  /campaigns/:campaignId/plot-threads/:threadId

GET    /campaigns/:campaignId/search
GET    /campaigns/:campaignId/revisions/:resourceType/:resourceId
POST   /campaigns/:campaignId/revisions/:revisionId/restore

POST   /campaigns/:campaignId/attachments/presign
POST   /campaigns/:campaignId/attachments/:attachmentId/complete

POST   /campaigns/:campaignId/exports
GET    /campaigns/:campaignId/exports/:exportId
POST   /imports
```

### 18.4 Idempotency

Use idempotency keys for operations such as:

- Session completion
- Export creation
- Import confirmation
- Invitation acceptance

---

## 19. Observability and Operations

### 19.1 Structured logs

Include:

- Timestamp
- Level
- Service/process
- Environment
- Request ID
- Route
- Method
- Status
- Duration
- User ID when available
- Campaign ID when available
- Stable error code

Never log:

- Passwords
- Raw tokens
- Private body content
- GM notes
- Full imported documents

### 19.2 Metrics

Track:

- Request rate
- Error rate
- Response latency
- Database latency
- Search latency
- Authentication failures
- Upload failures
- Job duration and failures
- Import/export duration
- Queue depth

### 19.3 Tracing

Trace:

- HTTP request
- Database operations
- Redis operations
- Object-storage calls
- Email delivery
- Import/export jobs

### 19.4 Alerts

Minimum production alerts:

- Sustained API error rate
- Database unavailable
- Queue failures
- Storage failures
- Email provider failures
- Backup failure
- Disk/connection exhaustion
- Repeated authorization anomaly

---

## 20. Testing Strategy

### 20.1 Unit tests

Focus on logic with branching rules:

- Permission calculations
- Metadata schemas
- Relationship compatibility
- Wiki-link extraction
- Plot-thread transitions
- Calendar validation
- Search query parsing
- Import ID remapping
- Export manifest generation

### 20.2 Backend integration tests

Use a real PostgreSQL test instance.

Required coverage:

- Registration and verification
- Login and refresh rotation
- Refresh-token reuse
- Campaign isolation
- Role permissions
- Entity visibility
- Relationship integrity
- Wiki-link backlink refresh
- Revision restore
- Search visibility
- Attachment authorization
- Import rollback

### 20.3 Frontend tests

- Forms and validation
- Visibility controls
- Relationship editor
- Wiki-link picker
- Autosave status
- Conflict UI
- Search filters
- Revision diff display
- Permission-gated actions

### 20.4 End-to-end tests

Critical Playwright suite:

1. Register and verify
2. Create campaign
3. Invite player
4. Accept invite
5. Create character and location
6. Create relationship
7. Add wiki link
8. Confirm backlink
9. Create session
10. Link entities and plot thread
11. Complete session
12. Reveal selected information
13. Verify player cannot see GM content
14. Search visible content
15. Upload image
16. Create map pin
17. Add timeline event
18. Restore revision
19. Export campaign
20. Import campaign
21. Revoke account session

### 20.5 Security tests

- Cross-campaign ID guessing
- Horizontal privilege escalation
- Role downgrade during active session
- Hidden search result leakage
- Hidden backlink leakage
- Unauthorized attachment URL generation
- Expired invite use
- Refresh reuse
- XSS payloads
- Oversized uploads
- MIME spoofing
- Malicious archives
- ZIP bombs within configured limits

### 20.6 Performance tests

Seed and test:

- 10,000 entities
- 50,000 relationships
- 2,000 plot threads
- 200 sessions
- 500 timeline events
- Multiple maps and attachments

Profile dashboard, search, entity details, relationship queries, exports, and imports.

---

## 21. Accessibility Requirements

Target WCAG 2.2 AA.

Release requirements:

- Complete keyboard navigation
- Visible focus states
- Semantic heading order
- Proper form labels
- Dialog focus trapping and restoration
- Screen-reader autosave announcements
- Error summaries
- Sufficient contrast
- No color-only status indicators
- Reduced-motion support
- Accessible TipTap toolbar
- Accessible map pin list as an alternative to the visual map
- Touch targets suitable for tablets

Accessibility defects in primary workflows are release blockers.

---

## 22. Performance Budgets

### 22.1 Frontend

- Avoid loading campaign content at application startup
- Lazy-load TipTap, map, and timeline bundles
- Paginate large collections
- Virtualize long entity selectors if necessary
- Optimize uploaded images
- Use route-level code splitting
- Avoid broad cache invalidation

Targets:

- Useful dashboard interaction within 3 seconds on normal broadband
- No persistent main-thread stalls above 100 ms during standard navigation
- Search overlay opens immediately from cached shell

### 22.2 Backend

Targets under normal load:

- p95 simple reads: under 300 ms
- p95 simple writes: under 500 ms
- p95 search: under 500 ms
- Background export/import may take longer but must report status

### 22.3 Database

- Review `EXPLAIN ANALYZE` for critical queries
- Add tenant-scoped indexes
- Avoid N+1 queries
- Use connection pooling
- Enable slow-query logging
- Test migrations on production-like data

---

## 23. Local Development Environment

Docker Compose services:

- PostgreSQL
- Redis
- MinIO
- Mailpit
- API
- Worker
- Web, optionally run directly for faster hot reload

Required developer commands:

```bash
pnpm install
pnpm dev
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:seed
pnpm build
```

The repository should include a single documented bootstrap path from clean clone to running application.

---

## 24. CI/CD Plan

### 24.1 Pull request pipeline

1. Install dependencies with frozen lockfile
2. Lint
3. Type-check
4. Unit tests
5. Backend integration tests
6. Frontend component tests
7. Build web
8. Build API and worker
9. Validate migrations
10. Dependency and secret scan
11. Upload coverage and artifacts

### 24.2 Main branch pipeline

1. Run pull-request checks
2. Build production images
3. Push images to registry
4. Deploy staging
5. Run staging migrations
6. Run smoke tests
7. Require approval for production during pre-v1
8. Deploy production
9. Run production smoke tests
10. Create release record

### 24.3 Migration policy

Use expand-and-contract migrations where possible:

1. Add compatible schema
2. Deploy code supporting old and new states
3. Backfill
4. Switch reads/writes
5. Remove obsolete schema in later release

Every destructive migration requires a backup and rollback plan.

---

## 25. Environments

### Local

Disposable development data with MinIO and Mailpit.

### Test

Ephemeral PostgreSQL and deterministic seed data.

### Staging

Production-like configuration, separate credentials, database, storage bucket, and email domain.

### Production

Managed PostgreSQL, managed Redis, private object storage, backups, monitoring, and restricted administrative access.

---

## 26. Backup and Recovery

Minimum production policy:

- Daily backups
- Point-in-time database recovery where available
- Object-storage versioning or retention protection
- Quarterly restore tests
- Soft-delete recovery window
- Documented emergency credential rotation

Required runbooks:

- Database restore
- Object-storage restore
- Failed migration rollback
- Accidental campaign deletion
- Compromised API secret
- Email provider outage
- Redis outage
- Queue backlog recovery

A backup is not considered valid until a restore has been tested.

---

# 27. Detailed Roadmap to v1.0

Each milestone must end in working software, passing tests, and updated documentation.

## Milestone 0 — Foundation [Done]

### Deliverables

- Monorepo
- React/Vite app
- NestJS API
- Worker process
- PostgreSQL, Redis, MinIO, Mailpit
- Drizzle migrations
- Environment validation
- Structured logging
- Health/readiness endpoints
- CI pipeline
- Base UI shell
- ADR template

### Exit criteria

- Clean clone runs locally from documented commands
- CI passes
- Web communicates with API
- Migrations and seed data work
- Health endpoints report dependency status

---

## Milestone 1 — Authentication and Account Security [Done]

### Deliverables

- Registration
- Email verification
- Login/logout
- Password reset
- Access/refresh flow
- Refresh rotation and reuse detection
- Account page
- Session list and revocation
- Rate limiting
- Security audit events

### Tests

- Invalid credentials
- Unverified account
- Expired verification/reset tokens
- Refresh reuse
- Revoked session
- Rate-limit behavior

### Exit criteria

- Full auth E2E passes
- Production cookie configuration is verified
- Security events are logged

---

## Milestone 2 — Campaign Tenancy and Membership

### Deliverables

- Campaign creation/list/switcher
- Campaign settings
- Archive/restore
- Invitations
- Role changes
- Member removal
- Campaign-scoped guards
- Permission-aware navigation

### Tests

- Cross-campaign isolation
- Invite expiration
- Role changes
- Removed-member access
- Owner-only actions

### Exit criteria

- No campaign resource can be accessed outside its tenant boundary
- All protected endpoints use campaign authorization

---

## Milestone 3 — Encyclopedia Core

### Deliverables

- Entity CRUD
- Core entity types
- Metadata schemas
- Rich-text editor
- Tags and aliases
- Visibility controls
- Autosave
- IndexedDB draft recovery
- Soft deletion
- Entity list filters

### Exit criteria

- All core entity types can be created and edited
- Hidden sections are omitted from unauthorized responses
- Draft recovery survives refresh and temporary network failure

---

## Milestone 4 — Relationships, Wiki Links, and Backlinks

### Deliverables

- Built-in relationship types
- Custom relationship types
- Relationship editor
- Reverse labels
- Wiki-link node and autocomplete
- Backlink extraction
- Incoming/outgoing panels
- Broken-link handling
- Related-content panel

### Exit criteria

- Renaming does not break references
- Hidden relationships do not leak
- Cross-campaign links are rejected

---

## Milestone 5 — Sessions

### Deliverables

- Session list/detail/editor
- Planned and completed states
- Participants
- Featured entities
- Locations
- Recap publication
- Session completion transaction
- Campaign date update
- Secret reveal workflow

### Exit criteria

- Completing a session atomically updates continuity data
- Player recap excludes GM-only material
- Entity pages show session appearances

---

## Milestone 6 — Plot Threads and Dashboard

### Deliverables

- Plot-thread CRUD
- Status transitions
- Importance
- Related entities and sessions
- Dormancy calculations
- Dashboard summaries
- Recent activity
- Unresolved and neglected thread panels

### Exit criteria

- Dashboard accurately surfaces dormant and active threads
- Session completion updates thread references

---

## Milestone 7 — Search

### Deliverables

- Full-text indexes
- Trigram name matching
- Weighted ranking
- Search overlay
- Results page
- Filters
- Keyboard navigation
- Highlighted snippets

### Exit criteria

- Search meets performance budget on seeded large campaign
- Hidden content never appears in result counts, titles, or snippets

---

## Milestone 8 — Revisions and Audit

### Deliverables

- Revision snapshots
- Revision history
- Field-level diff
- Restore
- Autosave revision grouping
- Audit activity view

### Exit criteria

- Restore creates a new revision
- Revision permissions match resource permissions
- Audit records cannot be edited through normal APIs

---

## Milestone 9 — Attachments

### Deliverables

- Presigned uploads
- Processing worker
- MIME detection
- Hashing
- Image metadata
- Resource attachment picker
- Cover images
- Signed downloads
- Cleanup jobs

### Exit criteria

- Files are private by default
- Invalid and oversized files are rejected
- Download permission matches resource permission

---

## Milestone 10 — Maps

### Deliverables

- Map CRUD
- Map image upload
- Layers
- Pin placement and drag
- Location links
- Visibility controls
- Filters
- Accessible pin list

### Exit criteria

- Pins stay aligned at different viewport sizes
- Hidden pins do not reach player clients
- Keyboard users can access all pin content

---

## Milestone 11 — Timeline and Calendar

### Deliverables

- Calendar settings
- Month/day configuration
- Structured date editor
- Timeline events
- Approximate/partial dates
- Entity and session links
- Filters
- Undated section

### Exit criteria

- Dates validate and sort consistently
- Existing dates remain interpretable after allowed calendar changes

---

## Milestone 12 — Export and Import

### Deliverables

- Export job
- Export status UI
- Versioned archive
- Checksums
- Import upload
- Dry-run report
- Transactional import
- ID remapping
- Import report
- Format migration layer

### Exit criteria

- Export/import round trip passes on a large seeded campaign
- Failed import leaves no partial data
- Malicious archives are rejected

---

## Milestone 13 — UX and Accessibility Hardening

### Deliverables

- Responsive desktop/tablet layout
- Complete loading/error/empty states
- Keyboard review
- Screen-reader review
- Contrast review
- Reduced-motion support
- Onboarding
- Help content
- Browser compatibility pass

### Exit criteria

- Primary workflows meet WCAG 2.2 AA expectations
- No blocking tablet-layout defects
- New users can complete onboarding without external help

---

## Milestone 14 — Performance, Security, and Reliability Hardening

### Deliverables

- Threat model
- Authorization audit
- Dependency review
- CSP and CORS review
- Rate-limit tuning
- Database query profiling
- Bundle analysis
- Load tests
- Backup restore drill
- Migration rehearsal
- Incident runbooks
- Monitoring and alerts

### Exit criteria

- No critical security findings
- No known authorization leaks
- Performance budgets pass
- Backup restore succeeds
- Rollback procedure is documented and tested

---

## Milestone 15 — Beta

### Deliverables

- Polished demo campaign
- Closed beta users
- Feedback capture
- Privacy policy
- Terms if required
- Support contact
- Error-report workflow
- Analytics decision
- Beta release notes

### Beta goals

- Validate navigation and terminology
- Validate campaign setup
- Validate at-table retrieval speed
- Find permission edge cases
- Find import/export failures
- Identify features users mistake Worldbinder for providing

### Beta exit criteria

- No unresolved data-loss defect
- No high-severity authorization defect
- Core flows have been used by outside users
- Major terminology and navigation confusion addressed

---

## Milestone 16 — v1.0 Release Candidate

### Deliverables

- Scope freeze
- Full regression pass
- Production smoke tests
- Final backup and restore test
- Architecture documentation
- API documentation
- Known issues
- Release notes
- Portfolio case study
- Screenshots and demo video

### Release blockers

- Data loss
- Unauthorized information disclosure
- Broken export/import round trip
- Broken password recovery
- Inaccessible primary workflow
- Failed backups or restore
- Unhandled migration failure
- Critical runtime errors

---

## 28. Demo Campaign Requirements

Ship a fictional demonstration campaign containing:

- 25–40 entities
- Every core entity type
- 40–60 relationships
- 4–6 sessions
- 6–10 plot threads
- Public and GM-only sections
- At least two player roles
- Two maps
- 10–15 timeline events
- Attachments
- Multiple revisions
- Search examples

The demo should immediately show why connected campaign knowledge is valuable.

---

## 29. Documentation Set

Required documentation before v1:

- Root README
- Local development setup
- Environment variable reference
- Architecture overview
- Data model overview
- Authorization model
- Import/export format
- Backup and recovery runbook
- Deployment runbook
- Incident response runbook
- Testing strategy
- Accessibility statement
- Privacy policy
- Release process
- Known limitations

### 29.1 Architecture Decision Records

Create ADRs for:

1. React and Vite
2. NestJS
3. Modular monolith
4. PostgreSQL over MongoDB
5. Drizzle over Prisma
6. REST over GraphQL
7. TipTap JSON as canonical rich text
8. Relationship table over Neo4j
9. S3-compatible storage
10. Access token plus rotating refresh sessions
11. Application-level revision snapshots
12. PostgreSQL full-text search
13. Campaign-scoped tenancy
14. Soft deletion
15. Versioned export format
16. Structured fantasy-calendar dates
17. IndexedDB local drafts
18. BullMQ job processing

Each ADR should include context, decision, alternatives, consequences, and revisit conditions.

---

## 30. Portfolio Case Study

The portfolio page should frame Worldbinder as:

> A multi-tenant, permission-aware knowledge-management platform built for complex campaign continuity.

Discuss:

- Product boundaries
- Domain modeling
- Relationship graph
- Wiki-link parsing
- Field-level authorization
- Search ranking
- Revision history
- Optimistic concurrency
- Attachment pipeline
- Import/export safety
- Testing pyramid
- CI/CD
- Observability
- Performance tuning
- Tradeoffs and deferred features

Do not reduce it to “a D&D notes app.”

---

## 31. v1.0 Release Checklist

### Product

- [ ] Authentication complete
- [ ] Campaigns complete
- [ ] Membership and roles complete
- [ ] Encyclopedia complete
- [ ] Rich text complete
- [ ] Relationships complete
- [ ] Wiki links complete
- [ ] Backlinks complete
- [ ] Sessions complete
- [ ] Plot threads complete
- [ ] Search complete
- [ ] Revisions complete
- [ ] Attachments complete
- [ ] Maps complete
- [ ] Timeline complete
- [ ] Export complete
- [ ] Import complete

### Security

- [ ] Argon2id configured
- [ ] Refresh rotation configured
- [ ] Refresh reuse handled
- [ ] Session revocation works
- [ ] Rate limits tested
- [ ] Cross-campaign isolation tested
- [ ] Field-level permissions tested
- [ ] Search leakage tested
- [ ] Backlink leakage tested
- [ ] Rich text sanitized
- [ ] Uploads validated
- [ ] Imports hardened
- [ ] CSP configured
- [ ] Secrets scanning enabled

### Reliability

- [ ] Backups enabled
- [ ] Restore tested
- [ ] Migration rollback tested
- [ ] Error monitoring active
- [ ] Metrics active
- [ ] Alerts active
- [ ] Health checks active
- [ ] Queue recovery documented

### Quality

- [ ] Unit suite passes
- [ ] Integration suite passes
- [ ] E2E suite passes
- [ ] Accessibility review passes
- [ ] Performance tests pass
- [ ] Browser tests pass
- [ ] Tablet layout passes
- [ ] No critical console errors

### Documentation

- [ ] README complete
- [ ] Setup guide complete
- [ ] Architecture docs complete
- [ ] API docs published
- [ ] Runbooks complete
- [ ] Privacy policy published
- [ ] Release notes published
- [ ] Known issues published
- [ ] Portfolio case study published

---

## 32. Final Scope Rule

Before accepting any feature into v1, ask:

1. Does it improve campaign memory, continuity, connection, retrieval, or controlled revelation?
2. Does it demonstrate a meaningful engineering capability not already shown elsewhere?
3. Can it be completed, tested, documented, and operated without delaying the core product?

If the answer is no, defer it.

Worldbinder v1 succeeds when it is a dependable connected campaign archive—not when it contains every feature a game master might ever use.
