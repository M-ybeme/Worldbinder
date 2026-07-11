# Worldbinder

Worldbinder is a permission-aware campaign encyclopedia and continuity manager for tabletop role-playing games. See [WORLDBINDER_V1_ROADMAP.md](./WORLDBINDER_V1_ROADMAP.md) for the full product and architecture plan.

## Stack

React 19 + Vite (`apps/web`), NestJS 11 (`apps/api`), a background worker process (`apps/worker`), PostgreSQL via Drizzle ORM, Redis, and object storage (MinIO locally, S3-compatible in production). See `docs/decisions/` for the reasoning behind these choices.

## Prerequisites

- Node.js 24 (see `.node-version`)
- pnpm (`npm install -g pnpm` if you don't have it)
- Docker Desktop (for local Postgres, Redis, MinIO, and Mailpit)

## Getting started

```bash
pnpm install
cp .env.example .env      # already done if you cloned this repo with .env present
pnpm infra:up              # starts Postgres, Redis, MinIO, Mailpit via Docker Compose
pnpm db:migrate
pnpm db:seed
pnpm dev                   # starts web (5173), api (3000), and worker together
```

Open http://localhost:5173 — the dashboard shows live API connectivity via the API's `/health` endpoint. `pnpm db:seed` creates a demo login: `gm@worldbinder.local` / `worldbinder-demo`.

Stop local infrastructure with `pnpm infra:down`.

## Authentication

Login uses a short-lived JWT access token (kept in memory on the frontend, never `localStorage`) plus a rotating, `HttpOnly`-cookie refresh token backed by a `user_sessions` row — see [ADR-0007](docs/decisions/0007-access-token-plus-rotating-refresh-sessions.md) for the full design and reuse-detection behavior.

Locally, registration/verification/password-reset emails go to Mailpit, not a real inbox — view them at http://localhost:8025.

## Common commands

| Command                             | Purpose                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Run all apps in dev/watch mode via Turborepo                                           |
| `pnpm build`                        | Build all apps and packages                                                            |
| `pnpm lint`                         | Lint all apps and packages                                                             |
| `pnpm typecheck`                    | Type-check all apps and packages                                                       |
| `pnpm test`                         | Run unit tests                                                                         |
| `pnpm test:integration`             | Run backend integration tests against a real Postgres/Redis (requires `pnpm infra:up`) |
| `pnpm db:migrate`                   | Apply pending Drizzle migrations                                                       |
| `pnpm db:seed`                      | Insert local development seed data                                                     |
| `pnpm infra:up` / `pnpm infra:down` | Start/stop local Docker Compose infrastructure                                         |

## Repository layout

```text
apps/web/      React + Vite frontend
apps/api/      NestJS API (modular monolith)
apps/worker/   Background worker process (shares the database with the API)
packages/      Shared contracts, validation schemas, UI primitives, and tooling config
infrastructure/  Docker Compose services and generated database migrations
docs/          Architecture, decisions (ADRs), runbooks, and testing docs
```

## Health checks

`GET /health` on the API reports the status of its own process plus Postgres and Redis connectivity, using `@nestjs/terminus`. The web app's dashboard page calls this endpoint on load to confirm frontend/backend wiring.
