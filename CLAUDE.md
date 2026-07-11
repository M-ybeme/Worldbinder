# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Worldbinder is a permission-aware campaign encyclopedia and continuity manager for tabletop RPGs (React 19/Vite frontend, NestJS 11 API, Postgres/Drizzle, Redis). Full product scope, data model, and the milestone-by-milestone build plan live in `WORLDBINDER_V1_ROADMAP.md` — read it before making product-scope or architecture decisions, not just code. `CHANGELOG.md` is the honest, dated record of what has actually shipped per milestone; trust it over inferring progress from file existence. `docs/decisions/*.md` are ADRs for the _why_ behind stack/architecture choices; `docs/planning/ui-ux.md` is the UX/navigation spec.

## Commands

Run from the repo root unless noted. All commands fan out across the pnpm/Turborepo workspace.

```bash
pnpm install
pnpm infra:up                # Postgres, Redis, MinIO, Mailpit via Docker Compose (required for api/worker dev + integration tests)
pnpm infra:down
pnpm db:migrate               # apply Drizzle migrations
pnpm db:seed                  # demo user: gm@worldbinder.local / worldbinder-demo
pnpm dev                      # web (5173) + api (3000) + worker together

pnpm build / pnpm lint / pnpm typecheck / pnpm test
pnpm test:integration          # backend integration tests against REAL Postgres/Redis/Mailpit — see Testing below
```

**Single test / single package**, since turbo's workspace commands don't take file filters:

```bash
pnpm --filter @worldbinder/api exec jest src/auth/password.service.spec.ts
pnpm --filter @worldbinder/api exec dotenv -e ../../.env -- jest --config ./test/jest-e2e.json auth.e2e-spec -t "full lifecycle"
pnpm --filter @worldbinder/web exec vitest run src/app/App.test.tsx
```

**`apps/api` and `apps/worker` scripts wrap themselves in `dotenv -e ../../.env --`** (see their `package.json`) because there's a single root `.env`, not per-app ones. If you invoke `nest`, `tsx`, or `jest` directly instead of through the package script, env vars won't be loaded — use `pnpm --filter <pkg> exec dotenv -e ../../.env -- <cmd>` or just use the existing script.

Drizzle migrations are generated, never hand-written: edit `apps/api/src/database/schema.ts`, then `pnpm --filter @worldbinder/api db:generate`, review the SQL in `infrastructure/migrations/`, then `pnpm db:migrate`. A local hook blocks direct edits to `infrastructure/migrations/` for this reason.

## Architecture

**Modular monolith**, not microservices (ADR-0003). One NestJS app; `apps/worker` is a second process sharing the same database for background jobs, not an independently deployed service.

**Backend module shape** (`apps/api/src/<domain>/`): `<domain>.module.ts` + `<domain>.service.ts` (orchestration/policy) + `<domain>.controller.ts` (transport only, stays thin). Only `ConfigModule`/`DatabaseModule`/`RedisModule` are `@Global()` — feature modules are not. Drizzle access goes through the `DRIZZLE` injection token from `database/database.module.ts`, never a raw client. See `auth/` for the fullest example of the pattern (service split further into `password.service.ts` / `token.service.ts` / `auth.service.ts` by responsibility, plus a guard + decorator in `auth/guards/`).

**Auth model** (ADR-0007): short-lived JWT access token returned in the response body and kept in-memory only on the frontend (Zustand store, never `localStorage`) + a long-lived opaque refresh token in an `HttpOnly`/`SameSite=Lax` cookie scoped to `/auth`, backed by a `user_sessions` row. Refresh rotates on every use; reusing an already-rotated token revokes the whole `token_family_id`, not just that token. `cookie-parser` is registered via `AppModule.configure()` (NestModule middleware), **not** in `main.ts` — Nest's testing module (`Test.createTestingModule` + `createNestApplication()`) never runs `main.ts`'s `bootstrap()`, so middleware registered only there silently doesn't apply under Jest.

**Shared packages** (`packages/`): `contracts` = API request/response TypeScript types consumed by both apps; `validation` = Zod schemas shared between frontend forms and backend `ZodValidationPipe`; `ui` = React primitives, deliberately built up only as real screens need them, not upfront; `config` = `loadEnv()` + the Zod env schemas (`apiEnvSchema`/`workerEnvSchema`); `tsconfig`/`eslint-config` = shared tooling config other packages extend.

**Frontend state**: TanStack Query for server state, Zustand only for client-only state (currently just the auth token/user), React Hook Form + `@hookform/resolvers/zod` for forms using the shared `packages/validation` schemas. `apps/web/src/features/auth/session.ts` wires the API client's 401 handling to a single shared refresh-token promise so concurrent requests don't each trigger their own refresh.

**Testing**: integration tests (`*.e2e-spec.ts` under `apps/api/test/`) run against a real Postgres/Redis/Mailpit, not mocks — this is deliberate (roadmap principle), not a shortcut. CI spins up service containers for this; locally, `pnpm infra:up` first. Auth integration tests poll Mailpit's REST API (`localhost:8025`) to retrieve verification/reset-password links rather than mocking mail delivery.

**Known environment footguns** (already fixed once, don't reintroduce): `z.coerce.boolean()` treats the string `"false"` as truthy — use the `booleanString()` helper in `packages/config/src/env.ts` for any new boolean env var. `SMTP_HOST` must stay `127.0.0.1`, not `localhost` — on at least one dev machine `localhost` resolves to `::1` first, where an unrelated process was squatting on port 1025 instead of Docker's Mailpit.

**Route naming**: the product nav calls the entity-browsing section "World" (route `/world`) — this is a UI/URL decision only. The backend module, `entities` table, and "encyclopedia" terminology elsewhere in the roadmap are unchanged; don't rename those to match.

## Project tooling

`.claude/skills/` (local-only, gitignored) has `db-migration`, `new-nest-module`, and `milestone-status` skills for this repo's specific workflows — check there before improvising a migration or new module by hand. `.claude/hooks/` auto-formats on write, blocks edits to generated paths, and requires `CHANGELOG.md` to be touched before `git push`. Commit messages follow `x.x.x — description` (version bump) or `hotfix — description` (no bump).
