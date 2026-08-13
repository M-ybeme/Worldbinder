# Architecture overview

Describes the system as it actually exists, not an aspirational target — see `WORLDBINDER_V1_ROADMAP.md` for the product plan and `docs/decisions/*.md` for the reasoning behind individual choices referenced below. For the security-framed view of the same system (trust boundaries, auth model, network-facing gaps), see `docs/security/threat-model.md` — this document covers the same processes from an architecture/maintenance angle instead.

## Processes

```
Browser (apps/web — React 19 SPA, served separately)
  │  HTTPS, JWT access token (Authorization header, in-memory only)
  │  refresh token (HttpOnly/SameSite=Lax cookie, scoped to /auth)
  ▼
API process (apps/api — NestJS 11) ──────────┐
  │  Drizzle/pg                              │  ioredis
  ▼                                          ▼
Postgres                                   Redis (rate limiting, health checks, BullMQ)
  ▲                                          │
  │  Drizzle/pg                              │  BullMQ
  │                                          ▼
Worker process (apps/worker) ────────────────┘
  │
  ▼
Object storage (MinIO locally / Cloudflare R2 in production — ADR-0012)
```

Three long-running processes today, one shared Postgres database:

- **`apps/api`** — the NestJS API. Everything user-facing goes through it: auth, campaign CRUD, entities, relationships, sessions, plot threads, search, revisions, attachments (presign/complete, not the actual file bytes), maps, timeline, exports/imports (enqueue only), health checks.
- **`apps/worker`** — a second Node process sharing the same database and object storage, consuming BullMQ jobs the API enqueues (ADR-0020): attachment magic-byte/dimension processing, export archive generation, import validation/execution, periodic cleanup sweeps. Never receives direct user input — only acts on job payloads the API already validated and enqueued.
- **`apps/web`** — the React SPA, built and served independently (Vite in dev, a static build in production). Talks to `apps/api` over HTTPS only; never touches Postgres, Redis, or object storage directly except via presigned upload/download URLs the API hands it.

This is a **modular monolith** (ADR-0003), not microservices — one deployable API unit, with the worker as a second process for background jobs, not an independently versioned/deployed service. Both processes import the same Drizzle schema and share migrations.

## Request lifecycle (`apps/api`)

1. **`main.ts`** boots the Nest app and starts listening. `instrument.ts` (Sentry/OpenTelemetry init) is imported first, deliberately, before anything else — see its own comment for why module-patching order matters.
2. **`AppModule.configure()`** (not `main.ts`) registers `helmet`, environment-driven CORS (`CORS_ORIGIN`, fails closed outside development), and `cookie-parser` as middleware on every route. This is deliberately in `configure()` rather than `main.ts`'s `bootstrap()`, because Nest's testing module (`Test.createTestingModule` + `createNestApplication()`) never runs `bootstrap()` — middleware registered only there would silently not apply under the integration test suite (see `CLAUDE.md`'s footgun note).
3. **`GlobalRateLimitGuard`** (`common/`, registered as `APP_GUARD`) applies a per-IP floor to every route before any handler runs.
4. **Per-route guards** — not global — layer on top where a route needs them: `JwtAuthGuard` (auth), `CampaignMembershipGuard` + `CampaignRolesGuard`/`@RequireCampaignRole` (campaign-scoped routes, ADR-0008). The membership guard resolves `:campaignId` against the caller's real membership row and returns `404` — never `403` — for both "campaign doesn't exist" and "not your campaign," so a non-member can't distinguish the two.
5. **Request bodies** are validated per-route via `ZodValidationPipe` against schemas from `packages/validation`, the same schemas the frontend's React Hook Form uses — one schema, two consumers.
6. **Service layer** does the actual work, calling `CampaignPolicyService` for the finer-grained permission checks a route-level guard can't express (§5.6's matrix), then Drizzle queries through the `DRIZZLE` injection token (never a raw client).
7. **`SentryGlobalFilter`** (`APP_FILTER`) catches anything unhandled and reports it — a safe no-op when `SENTRY_DSN` is unset, since `instrument.ts` never called `Sentry.init` in that case.

## Module boundaries (`apps/api/src/`)

Each domain is its own Nest module: `auth`, `membership`, `campaigns`, `entities`, `relationships`, `sessions`, `plot-threads`, `timeline`, `maps`, `attachments`, `revisions`, `search`, `exports`, `imports`, `audit`, `health`, plus cross-cutting `common`, `config`, `database`, `redis`, `storage`, `mail`. Only `ConfigModule`, `DatabaseModule`, and `RedisModule` are `@Global()` — every feature module is explicit about what it imports, so a module's real dependencies are visible from its own `*.module.ts` rather than assumed ambient availability.

Within a domain module, the shape is consistent (see `CLAUDE.md`'s "Backend module shape" and `auth/`'s example, the fullest case — split further into `password.service.ts`/`token.service.ts`/`auth.service.ts` by responsibility): a `*.module.ts` wiring things together, a `*.service.ts` doing orchestration and policy, and a `*.controller.ts` that stays thin — transport only, no business logic.

`apps/worker/src/` mirrors the same domain boundaries only where it needs to (`attachments/`, `exports/`, `imports/`, plus its own `jobs/` for the BullMQ queue consumers and connection setup) — it's not a full copy of the API's module set, only the pieces that do background work.

## Shared packages (`packages/`)

- **`contracts`** — API request/response TypeScript types, consumed by both `apps/api` and `apps/web`. The single source of truth for what a resource "looks like" over the wire (e.g. `EntityDetail`, `TiptapDoc`, `CalendarConfig`).
- **`validation`** — Zod schemas shared between the frontend's React Hook Form (`@hookform/resolvers/zod`) and the backend's `ZodValidationPipe` — one schema validates both a form before submit and a request body on arrival.
- **`ui`** — React primitives (`Button`, `TextField`, `LoadingState`, etc.), deliberately built up only as real screens need them, not speculatively upfront.
- **`config`** — `loadEnv()` plus the Zod env schemas (`apiEnvSchema`/`workerEnvSchema`), including shared helpers like `booleanString()` (see `CLAUDE.md`'s environment footgun notes) and `rejectDevOnlyValuesOutsideDevAndTest`.
- **`tsconfig`** / **`eslint-config`** — shared tooling config the other packages extend, so lint/type-check rules aren't duplicated per app.

## Frontend structure (`apps/web/src/`)

- **`routes/`** — the router config, lazy-loaded per route (Milestone 14 Phase 7's bundle-splitting work) so a screen's code only loads when actually navigated to.
- **`features/`** — one directory per domain (`entities`, `campaigns`, `membership`, `search`, ...), each typically holding `api/` (thin fetch wrappers), `hooks/` (TanStack Query hooks), `components/`, and `pages/`. Mirrors the backend's module-per-domain shape without being a literal 1:1 mapping.
- **`stores/`** — Zustand, used only for genuinely client-only state (currently the auth token/user and the search-overlay open/closed flag) — everything server-derived goes through TanStack Query instead, not duplicated into a store.
- **`lib/`** — the API client (`apiClient.ts`, wires 401 handling to a single shared refresh-token promise so concurrent requests don't each trigger their own refresh — see `apps/web/src/features/auth/session.ts`) and other cross-cutting utilities.
- **`app/App.tsx`** — the root layout: header, nav, and a single `<Outlet />` inside `<main className="app-shell__main">`. Campaign-scoped routes nest a second layout (`CampaignLayout`, its own `<Outlet context={{ campaign }} />`) inside that one.

## Deployment topology (not yet provisioned — Milestone 16)

Local development runs everything via Docker Compose (`pnpm infra:up`: Postgres, Redis, MinIO, Mailpit) plus `pnpm dev` for the three Node processes. CI (`.github/workflows/ci.yml`) spins up ephemeral Postgres/Redis/Mailpit service containers for the same integration suite. Production is planned for Railway (API and worker as separate services, Railway-managed Postgres/Redis) at `worldbinder.net`, Cloudflare R2 replacing MinIO, Resend replacing Mailpit (ADR-0021), and Sentry for monitoring — see `WORLDBINDER_V1_ROADMAP.md`'s Milestone 16 section for the concrete provisioning checklist. None of that infrastructure exists yet as of this document.
