# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/) — a pre-1.0 project, so `0.MINOR.PATCH` bumps for any user-visible or structural change, `PATCH` for fixes with no scope change.

Every push to `main` should add an entry here. This is meant to be an honest record of what actually shipped, not a restatement of the roadmap's aspirations — if something was attempted and reverted, or shipped partially, say so.

## [Unreleased]

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
