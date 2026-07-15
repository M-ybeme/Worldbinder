# Threat model

Written as part of Milestone 14 (Performance, Security, and Reliability Hardening). Describes the system as it actually exists on 2026-07-15, not an aspirational target — see `WORLDBINDER_V1_ROADMAP.md`'s Milestone 14 phase notes for the specific gaps found and their fix status.

## System overview

Worldbinder is a modular monolith (ADR-0003): one NestJS API process, one worker process (background jobs — attachment processing, exports, imports), sharing one Postgres database. The frontend is a React SPA served separately. Today everything runs via local `docker-compose` (Postgres, Redis, MinIO, Mailpit) or CI's ephemeral service containers — **there is no staging or production environment yet**. The intended future target (not yet provisioned, deliberately — see below) is Railway for the API/worker plus Railway-managed Postgres/Redis, Cloudflare R2 replacing MinIO, a transactional email provider (Resend or Postmark) replacing raw SMTP, and Sentry for error monitoring.

## Trust boundaries

```
Browser (untrusted)
  │  HTTPS, JWT access token (Authorization header, in-memory only)
  │  refresh token (HttpOnly/SameSite=Lax cookie, scoped to /auth)
  ▼
API process (apps/api) ──────────┐
  │  Drizzle/pg                  │  ioredis
  ▼                              ▼
Postgres                       Redis (rate limiting, health checks, BullMQ)
  ▲                              │
  │  Drizzle/pg                  │  BullMQ
  │                              ▼
Worker process (apps/worker) ────┘
  │
  ▼
Object storage (MinIO locally / R2 planned) — attachments, export archives
```

- The browser is the only untrusted boundary. Everything right of the API is trusted infrastructure the API/worker control directly — no third-party API calls happen mid-request today except outbound email (SMTP) and object storage (S3-compatible API), both server-initiated, not user-reachable directly.
- The worker never receives direct user input — it only acts on job payloads the API enqueued, reading/writing the same database and object storage.

## Authentication and session model (ADR-0007)

Short-lived (15 min) signed JWT access token, kept in-memory on the frontend only (never `localStorage`). Long-lived (30 day) opaque refresh token in an `HttpOnly`/`SameSite=Lax` cookie scoped to `/auth`, backed by a `user_sessions` row. Refresh rotates on every use; presenting an already-rotated token revokes the whole `token_family_id` and logs a `refresh_reuse_detected` security event — the standard defense against a stolen refresh token being replayed after the legitimate client already rotated past it.

**Known gaps** (Milestone 14 Phase 4b): the refresh cookie's `Secure` flag needs to be environment-conditional (forced true outside local dev) rather than always matching dev's plain-HTTP default. `JWT_ACCESS_SECRET` is required and length-validated (≥32 chars) at boot, but `.env.example`'s placeholder value is long enough to pass that check unchanged — a deploy that copies `.env.example` without generating a real secret boots successfully with a well-known signing key. `STORAGE_ACCESS_KEY_ID`/`STORAGE_SECRET_ACCESS_KEY` silently default to the known local dev/MinIO values if unset, rather than failing closed outside development.

## Authorization model (ADR-0008, ADR-0009)

Every campaign-scoped resource is gated two ways: a coarse route-level `CampaignRolesGuard`/`@RequireCampaignRole(...)` allow-list, and finer-grained `CampaignPolicyService` checks in the service layer for matrix cells that depend on more than just the actor's role (GM's "Limited" settings access, Editor's "Configurable" GM-content visibility). Cross-campaign isolation is enforced by scoping every resource lookup on both the resource's own id _and_ `campaignId` — a mismatched id returns 404, not another campaign's data, matching the "don't confirm existence" rule ADR-0008/ADR-0009 both establish for `gm_only` content.

This model was audited in Milestone 14 Phase 1 and found solid: every spot-checked controller (entities, sessions, maps, attachments, membership, exports) layers both checks correctly. Two inconsistencies were found and fixed (route-level guard missing on `CampaignsController.update()`; `AttachmentsService`'s `complete()`/`delete()` writes not re-asserting `campaignId`) — see the roadmap's Phase 1 notes for detail. No cross-tenant data leak was found to be actually exploitable.

Visibility (ADR-0009) is a two-tier enum (`public`/`gm_only`) reusing the same role-plus-flag check everywhere it applies (entities, relationships, wiki-link backlinks) — deliberately not a per-member grants system, since no real workflow needs finer granularity yet.

## Network-facing surface and known gaps

- **CORS** (`apps/api/src/main.ts`): currently a boolean (`origin: NODE_ENV === 'development'`), not a real allow-list — reflects any origin in dev, disabled entirely otherwise. No `CORS_ORIGIN` env var exists yet. Fixed in Phase 4 to be a real, env-driven allow-list.
- **CSP**: none configured anywhere (`helmet` isn't a dependency). Fixed in Phase 4 with env-driven directive values that default to `'self'`/off, so it tightens automatically once real storage/monitoring domains exist without needing this phase redone.
- **Rate limiting** (`apps/api/src/common/rate-limiter.service.ts`): applied manually per-call-site, not globally. Covers `register`/`login`/`resendVerification`/`forgotPassword` and `inviteMember`. Does **not** cover `verify-email`/`refresh`/`logout`/`reset-password`/`change-password`, nor any endpoint outside auth/membership (entities, sessions, maps, attachments, exports, imports, campaigns CRUD) — relevant for bulk-creation, export-generation, and presigned-upload abuse. Addressed in Phase 5.
- **Dependencies**: `pnpm audit` found 14 vulnerabilities (1 critical, 4 high, 8 moderate, 1 low) at audit time. Most consequential: `nodemailer` (SSRF, arbitrary file read, injection CVEs — many majors behind the patched line) and `drizzle-orm` (SQL injection, used in every query). Upgraded separately, in order, per an explicit user-directed process — see Phases 2–3.

## Data protection

- Passwords hashed with argon2 (not bcrypt) — current, appropriately-slow choice.
- Email-verification and password-reset tokens are hashed (SHA-256) before storage; only the hash is ever persisted.
- Entity content is split `public`/`gm_only` at the field level — an unauthorized response omits `gmContentJson` entirely rather than returning `null`, so response shape itself doesn't leak whether hidden content exists.
- No encryption at rest beyond whatever the underlying Postgres/object-storage provider offers by default — not something this application layer controls either way.

## Availability and reliability risks

- **No backups exist today** (Phase 12) — local docker-compose volumes are the only persistence, with no snapshot/retention. A local backup/restore script and rehearsal are this milestone's deliverable; a live drill against real hosted infrastructure is deferred to Milestone 16 once that infrastructure exists.
- **Migrations are forward-only** — drizzle-kit doesn't generate down-migrations by design. "Rollback" for this project means restore-from-backup, not a reverse migration. Documented and rehearsed in Phase 12.
- **No monitoring/alerting exists today** — structured logging (`pino`) goes to stdout with no aggregation, and there's no APM/error-tracking. The Sentry SDK is wired in (Phase 11) but env-gated off until a real DSN exists — no live alerting is tested this milestone.
- Several real N+1/missing-index performance gaps exist (Phase 6) — treated here as an availability risk, not just a latency one, since an unindexed query under real load can exhaust connection pool capacity for unrelated requests.

## Deliberately out of scope for Milestone 14

Per an explicit product decision (2026-07-15): the application is to be feature-complete before any real hosting environment is provisioned. This milestone makes every hosting-dependent integration point (CORS, CSP, cookies, secrets, storage backend, email transport, monitoring, health checks, backup/restore tooling) environment-driven and swappable, but does **not** create a Railway project, R2 bucket, Resend/Postmark account, or Sentry project, and does not run any live drill against real hosted infrastructure. That provisioning work, plus the live backup restore drill, live alert testing, and production smoke tests, is explicitly deferred to Milestone 16 (v1.0 Release Candidate) — see that milestone's own forward-reference note in the roadmap.
