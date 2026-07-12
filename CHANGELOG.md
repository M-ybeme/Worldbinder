# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/) — a pre-1.0 project, so `0.MINOR.PATCH` bumps for any user-visible or structural change, `PATCH` for fixes with no scope change.

Every push to `main` should add an entry here. This is meant to be an honest record of what actually shipped, not a restatement of the roadmap's aspirations — if something was attempted and reverted, or shipped partially, say so.

## [Unreleased]

## [0.5.0] - 2026-07-12

### Added

- **Milestone 4 — Relationships, Wiki Links, and Backlinks.** Typed relationships between entities (14 built-in types plus per-campaign custom types), `[[wiki-link]]` mentions inside rich text, backlink tracking, and the incoming/outgoing/backlinks panels that surface them on the entity detail page — both API and web UI.
- New schema: `relationship_types` (built-ins have `campaign_id = null`, shared across every campaign; custom types are per-campaign), `entity_relationships` (no reverse row is ever stored — the reverse direction is a query projection using the type's `reverseLabel`), `entity_wiki_links`, plus a `wiki_link_section` enum. `relationship_types.key` uniqueness needed two *partial* unique indexes rather than one composite constraint, since Postgres treats every `NULL` as distinct in an ordinary unique index and would otherwise let two built-in rows share a key.
- `relationships` module (`apps/api/src/relationships/`): relationship-type list/create, relationship create/update/delete, and a "neighborhood" query (`GET .../entities/:entityId/relationships`) that returns both directions already labeled and visibility-filtered. Built-ins are provisioned idempotently via `RelationshipTypesService.onModuleInit` (`onConflictDoNothing` targeting the primary key — the partial-unique-index-on-`key` approach doesn't work as an `ON CONFLICT` arbiter without repeating its predicate, and hand-editing a migration to `INSERT` seed rows isn't allowed, so each built-in type has a fixed id instead).
- `entities/wiki-links.service.ts`: extracts `entityMention` nodes from TipTap JSON on every entity save, validates every mention resolves to a live entity in the same campaign (a cross-campaign or dangling mention is a hard `400`, not a silent drop — same tenant-isolation stance as ADR-0008), and full-replaces the stored links per content section (same pattern as tag sync). Backlinks and relationships share one visibility predicate now: `CampaignPolicyService.canViewVisibility` (`EntitiesService.requireVisibleEntity` was refactored onto it too) — a public relationship or backlink pointing at a `gm_only` entity is invisible to anyone who can't see that entity, not just entities themselves.
- Frontend: a `[[`-triggered entity-mention autocomplete in `RichTextEditor` (new `@tiptap/suggestion`-based `entityMention` node, hand-rolled popup rather than pulling in `tippy.js`), a new `packages/ui` `Combobox` primitive plus an `EntityPicker` built on it (now also used to fill in the `*EntityId` cross-reference metadata fields — `currentLocationEntityId`, `leaderEntityId`, etc. — that Milestone 3 explicitly left unwired), and a `RelatedContentPanel` on the entity detail page combining relationships (with an inline "+ Relationship" create form) and backlinks.
- 4 new unit tests (`checkRelationshipTypeCompatibility`, factored out of `RelationshipsService` specifically so compatibility logic doesn't need a database to test) plus 5 (`WikiLinksService.extractMentions`) plus 2 (`CampaignPolicyService.canViewVisibility`), and 15 new integration tests (`relationships.e2e-spec.ts`, `wiki-links.e2e-spec.ts`) covering reverse-label projection, cross-campaign rejection, duplicate/symmetric-duplicate detection, type-compatibility rejection, backlink refresh-on-update, and the visibility-leak cases (hidden relationship, public relationship to a hidden entity, GM-only-section backlink). Extended `apps/web/e2e/relationships.spec.ts`: relationship creation + reverse projection, a `[[` mention creating a backlink, and a player confirmed unable to see a `gm_only` relationship.
- Scope note: no `/world/relationships` graph or list view this milestone — relationships surface as per-entity panels only, matching the milestone's actual deliverables rather than the later portfolio "relationship graph" polish item (roadmap §30).

### Fixed

- `@tiptap/suggestion`'s `allowSpaces` defaults to `false`, which silently closes the mention popup the instant the user types a space — fatal for a picker whose whole purpose is searching multi-word entity names ("Westvale Village"). Found via a real browser run (typing `[[Duke Ren` looked fine; `[[Duke Renald` didn't), not by the Jest/unit suites, which don't drive a real ProseMirror `contentEditable`. Fixed by setting `allowSpaces: true` on the extension's `Suggestion` config.

## [0.4.0] - 2026-07-11

### Added

- **Milestone 3 — Encyclopedia Core.** Campaign-scoped entities across all 11 core types (Character, Location, Faction, Organization, Item, Deity, Creature, Event, Quest, Lore, Custom), each with a type-specific JSONB metadata schema, tags, aliases, public/GM-only content split, visibility controls, soft deletion, and list filters (type/tag/name search) — both API and web UI.
- New schema: `entities`, `tags`, `entity_tags`, plus `entity_type`/`entity_status`/`entity_visibility` enums. Metadata schemas are versioned via an embedded `schemaVersion` key rather than a DB column (no existing precedent for the latter; see `packages/validation/src/entities.ts` for all 11 per-type schemas, combined into the repo's first `z.discriminatedUnion` on `entityType`).
- `entities` module (`apps/api/src/entities/`): CRUD, transactional tag find-or-create-and-link, campaign-scoped slugs, soft delete, list filters, and optimistic concurrency (`updatedAt`-based, `409 Conflict` on a stale write per roadmap §15.2). `CampaignPolicyService` gained `canEditEntities` (owner/GM/editor — Player is "Optional" per §5.6 but v1 has no toggle for it yet, so Player/Viewer stay read-only).
- **Field-level filtering (§13.2) has its first real implementation.** `EntityDetail.gmContentJson` is a genuinely optional contract field, included in the API response only when `canViewGmContent` allows it — omitted entirely otherwise, never sent as `null`. The same check also gates whether a `gm_only`-visibility entity is visible at all (a 404, not a 403, to a player — same non-disclosure reasoning as ADR-0008). See [ADR-0009](docs/decisions/0009-entity-visibility-two-tier.md) for why entity visibility is a plain two-tier enum rather than the roadmap's fuller per-member grants model.
- Frontend `World` section: `/app/campaign/:id/world` (list + filters), `/world/new` and `/world/:entityId/edit` (create/edit form), `/world/:entityId` (detail view) — all behind the existing `CampaignLayout`. New `packages/ui` primitives `Textarea` and `TagInput`.
- **TipTap rich-text editor** (`@tiptap/react` + StarterKit + Link + Table extensions) for public and GM-only content, with an accessible toolbar (roadmap §21). Image and entity-wiki-link/mention nodes are deliberately not included yet — both are genuinely blocked (no attachment upload pipeline until Milestone 9, no link-resolution backend until Milestone 4's wiki-link module), not just deferred by preference.
- **Autosave with IndexedDB draft recovery** (`idb`): edits to an existing entity debounce into a PATCH ~2s after idling; on failure (offline or a 409 conflict) the pending change is kept in IndexedDB instead of lost, with `Saving/Saved/Offline/Save failed` status shown near the editor and a restore-or-discard banner on next visit. A 409 conflict surfaces a small inline "changed elsewhere" notice (reload vs. keep-mine) rather than silently overwriting — no diff view yet, that's later UX polish.
- Extended the Milestone 2 Playwright scaffolding: `apps/web/e2e/entities.spec.ts` covers the full entity lifecycle (create with tags/metadata/split content, a player seeing public but not GM content, edit, tag filter, delete) plus a real offline-mid-edit probe using `context.setOffline()` to verify the draft survives a dropped connection and syncs once back online. Shared registration/login/campaign-setup helpers extracted to `apps/web/e2e/helpers.ts` (now a third consumer, `apps/web/playwright.config.ts` pinned to `workers: 1` to match the Jest e2e suite's `maxWorkers: 1` reasoning — specs share real IP-scoped rate limits and a real Mailpit inbox).
- 12 new unit tests (`canEditEntities` cases) and 11 new integration tests (`entities.e2e-spec.ts`) covering CRUD, tag reuse, cross-campaign isolation, soft delete, the stale-write 409, and the field-omission/entity-visibility checks.

### Fixed

- `apps/web/eslint.config.js` now ignores `playwright-report/` and `test-results/` — without it, `eslint .` was linting Playwright's own generated (minified) HTML-report JS bundle, producing thousands of spurious `no-undef`/`no-unused-expressions` errors the moment those directories existed locally.
- `packages/ui`'s `TagInput` didn't associate its `<label>` with its `<input>` (no `htmlFor`/`id`), so it was both an accessibility gap (§21: "proper form labels") and invisible to `getByLabel` in tests. Fixed via `useId()`.
- The Milestone 3 entity forms use plain `useState` rather than react-hook-form (the discriminated-union input types don't type-check cleanly against RHF's `register()` across a dynamic per-type field set), which meant none of their `TextField`/`Textarea`/`Select` fields had a `name`/`id` — same label-association gap as above, just self-inflicted this time. Fixed by passing explicit `id`s throughout `EntityFormPage`, `EntityMetadataFields`, and `WorldListPage`.

## [0.3.0] - 2026-07-10

### Added

- **Milestone 2 — Campaign Tenancy and Membership.** Campaign creation/list/switcher, campaign settings, archive/restore, invitations, role changes, member removal — both API and web UI.
- New schema: `campaigns`, `campaign_members` (unique per `campaign_id`+`user_id`, soft-removed via `status` rather than deleted so history survives), `campaign_invitations`, plus `campaign_status`/`campaign_role`/`campaign_member_status` enums.
- `membership` module: `CampaignPolicyService` encoding the §5.6 permission matrix (including its "Limited"/"Configurable" cells — a GM can't act on the owner or another GM, an Editor's GM-content visibility follows their per-member `editor_secret_access` flag), `CampaignMembershipGuard` + `CampaignRolesGuard` + `@CurrentMembership`/`@RequireCampaignRole` for campaign-scoped route authorization, invitation issue/accept/revoke with the same opaque-token pattern as email verification. See [ADR-0008](docs/decisions/0008-campaign-scoped-authorization.md) for why non-members get a 404 rather than a 403, and why this is a guard-plus-policy-service split rather than a single roles guard.
- `campaigns` module: CRUD, owner-only rename and delete, owner+GM settings/archive/restore, transactional campaign creation (creator becomes `owner` in the same transaction as the campaign row).
- New campaign invitation email (`MailService.sendCampaignInviteEmail`), reusing the verification/reset-email pattern.
- Frontend: `/app/campaigns` list+create, `/app/campaign/:id` (overview/settings/members) behind a new `RequireCampaignMembership` guard, a header campaign switcher, an invite-and-manage-members UI on the Members page, and `/accept-invitation/:token`. New `packages/ui` `Select` primitive for role pickers.
- 10 new unit tests (`CampaignPolicyService` truth table) and 18 new integration tests covering cross-campaign isolation, invitation accept/expire/revoke/email-mismatch, GM's restricted role-management scope, member removal revoking access immediately, and owner-only actions.
- `@playwright/test`, pulled forward from Milestone 13/20 (roadmap §6.2, §20.4) to verify this milestone through a real browser rather than only via `curl`. `apps/web/e2e/campaign-membership.spec.ts` drives roadmap §20.4's suite items 1–4 (register/verify, create campaign, invite, accept) plus this milestone's switcher/nav-gating/role-change/removal/archive/tenant-isolation flows end to end. Local-only for now (`pnpm --filter @worldbinder/web test:e2e`, requires `pnpm infra:up` + `pnpm dev` already running) — not yet wired into `turbo.json`'s `test` pipeline or CI, since that needs the whole stack live, which CI doesn't orchestrate yet.

### Fixed

- **`VerifyEmailPage` never resolved when driven through an actual browser** (only ever exercised via `curl`/integration tests before, which don't run React at all). It called `verifyEmail.mutate()` from inside a `useEffect`; React 19's `<StrictMode>` double-invokes effects in dev, which discards the first (real, in-flight) `useMutation` observer and mounts a fresh one that never gets `.mutate()` called on it (a `submitted` ref correctly prevented a second _network_ call, but the second _observer_ still needed one to ever leave the pending state) — so the page was stuck on "Verifying…" forever despite the API call succeeding. This was a pre-existing bug since Milestone 1, invisible until this milestone's Playwright work actually loaded the page in a browser. Fixed by switching to `useQuery` keyed on the token — the idiomatic "run once on mount" primitive, whose cache-based dedup means both the discarded and the current observer share the same result. Removed the now-unused `useVerifyEmail` mutation hook.
- **`@worldbinder/contracts`/`@worldbinder/validation` failed to load in the browser** ("does not provide an export named ...") the first time any page importing them was actually visited, for the same reason as above: nothing had ever driven the frontend through a real browser before. Vite doesn't pre-bundle pnpm workspace-linked packages by default, so it served their CommonJS `dist/index.js` raw via `/@fs/`, and native ESM import of raw CJS can't reliably detect named exports. Fixed via `optimizeDeps.include` in `apps/web/vite.config.ts`, forcing them through esbuild's CJS→ESM interop. (Left as CJS rather than switching those packages to `"type": "module"`, since the CJS NestJS API/worker also depend on them and can't `require()` an ESM module.)
- `test/jest-e2e.json` now pins `maxWorkers: 1`. With three e2e spec files sharing one real Redis instance, Jest's default parallel workers raced on the IP-scoped login rate limiter — each suite clears `ratelimit:*` at its own `beforeAll`, but concurrent suites interleaved their login volume against the same shared key, occasionally exceeding the limit mid-suite. Serial execution was the only option that didn't mean loosening a real rate limit just to make tests convenient.
- Extracted `createVerifiedUser`/`uniqueEmail`/`findEmailToken` out of `auth.e2e-spec.ts` into `test/helpers/test-users.ts` now that three suites need them.

## [0.2.0] - 2026-07-11

### Added

- **Milestone 1 — Authentication and Account Security.** Registration with email verification, login/logout, forgot/reset password, authenticated change-password, and session list/revocation — both API and web UI.
- Access/refresh token design: short-lived JWT access tokens (in-memory on the frontend, never `localStorage`) plus opaque, rotating, `HttpOnly`-cookie refresh tokens backed by `user_sessions`, with reuse detection that revokes the whole session family on replay. See [ADR-0007](docs/decisions/0007-access-token-plus-rotating-refresh-sessions.md).
- Argon2id password hashing (`PasswordService`) with opportunistic rehash-on-login when parameters change.
- Redis-backed rate limiting on register/login/forgot-password/resend-verification.
- Security event audit log (`security_events` table) covering registration, login success/failure, password changes, session revocation, and refresh-token reuse.
- Transactional email via nodemailer → Mailpit locally (verification and password-reset links).
- New schema: `user_credentials`, `user_sessions`, `email_verification_tokens`, `password_reset_tokens`, `security_events`, plus a `status` column on `users`.
- Frontend: TanStack Query + Zustand wired up for the first time (auth state, session bootstrap on app load), React Hook Form + Zod-resolver forms, first `packages/ui` primitives (`Button`, `TextField`, `FormMessage`), account pages (`/account/profile`, `/account/security`, `/account/sessions`).
- 12 new unit tests (password/token services) and 19 new integration tests covering the full auth lifecycle, invalid credentials, unverified-account rejection, expired tokens, refresh reuse, session revocation, password reset, and rate limiting.
- CI: `integration-tests` job now also runs a Mailpit service container and the required `JWT_ACCESS_SECRET`.
- Product decisions recorded ahead of Milestone 2: Timeline and the relationship graph live under **World** as views, not top-level nav destinations; players get read-only **Threads** access with field-level filtering and a projected player-facing status vocabulary distinct from the internal GM status. Reflected in `WORLDBINDER_V1_ROADMAP.md` (§3.5, §5.4, §5.6, §9.8, §10.1) and `docs/planning/ui-ux.md`.
- `CLAUDE.md` — commands, module conventions, the auth token model, and known environment footguns, so a fresh session doesn't have to re-derive them.
- `update-index` Claude Code skill (local-only) that keeps `CLAUDE.md` accurate when a documented path/command turns out stale or a real architectural addition goes undocumented.

### Fixed

- `z.coerce.boolean()` treating the literal string `"false"` as `true` (JS `Boolean("false")` semantics) — `SMTP_SECURE=false` was silently being read as `true`. Replaced with a schema that parses the literal strings.
- Nodemailer connecting to the wrong process entirely: `localhost:1025` resolved to `::1` first on this machine, where an unrelated `wslrelay.exe` was squatting on that port instead of Docker's Mailpit. Pinned `SMTP_HOST` to `127.0.0.1`.
- `cookie-parser` middleware was only registered in `main.ts`'s `bootstrap()`, which Nest's testing module (`Test.createTestingModule` + `createNestApplication()`) never calls — so refresh-cookie-dependent requests silently failed under Jest even though they worked when run manually. Moved to `AppModule.configure()` so it applies regardless of how the app is bootstrapped.
- `register()` silently no-op'd on retry for a user who existed but had never verified their email (e.g. after a prior request failed before the email sent) — now resends verification instead of the request going nowhere.

## [0.1.0] - 2026-07-10

### Added

- **Milestone 0 — Foundation.** Monorepo scaffold: pnpm workspaces + Turborepo, `apps/web` (React 19 + Vite), `apps/api` (NestJS 11), `apps/worker`, shared `packages/{contracts,validation,ui,config,eslint-config,tsconfig}`.
- Docker Compose local infrastructure: PostgreSQL, Redis, MinIO, Mailpit, all with healthchecks.
- Drizzle ORM wired up end-to-end: schema (`users` table), first generated migration, seed script.
- `GET /health` on the API reporting live PostgreSQL and Redis connectivity via `@nestjs/terminus`, with structured Pino logging across API and worker.
- Web app shell with a live API-connectivity status widget (real cross-origin fetch to `/health`, CORS configured).
- GitHub Actions CI: lint, typecheck, unit tests, build, a separate integration-test job against real Postgres/Redis service containers, a migration-drift check, and a secret scan.
- Root README with local bootstrap instructions; ADR template plus six initial architecture decision records (React/Vite, NestJS, modular monolith, PostgreSQL over MongoDB, Drizzle over Prisma, REST over GraphQL).
- Claude Code project tooling: hooks (auto-format on write, block hand-edits to generated paths, auto `pnpm install` on `package.json` changes, changelog-on-push check) and skills (`db-migration`, `new-nest-module`, `milestone-status`), all local-only (gitignored). This changelog.

### Fixed

- TypeScript/esbuild version mismatch that broke `drizzle-kit generate` (`ES2023` target unsupported by drizzle-kit's pinned esbuild).
- ESM/CommonJS interop failures between the shared `packages/*` and Jest, and between `apps/worker` and `ioredis`'s CJS types.
- Stale `vite`/`@vitejs/plugin-react` version pairing that broke the web dev server.
