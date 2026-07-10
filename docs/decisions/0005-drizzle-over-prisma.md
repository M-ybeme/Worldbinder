# ADR-0005: Drizzle over Prisma

**Status:** Accepted
**Date:** 2026-07-10

## Context

The API needs a type-safe way to define schema, generate migrations, and query PostgreSQL from TypeScript.

## Decision

Use Drizzle ORM with `drizzle-kit` for schema definition, migration generation, and typed queries.

## Alternatives considered

- **Prisma:** More mainstream and has a friendlier migration CLI, but its generated client is a black box at runtime and its query builder pushes some non-trivial queries (recursive backlink lookups, weighted full-text search ranking) toward raw SQL escape hatches. Drizzle's query builder stays close to SQL, which matters for the search and relationship-graph queries this project needs to hand-tune.
- **Raw `pg` with hand-written SQL and a lightweight migration runner:** Would remove the schema-as-code benefit and make refactors (renaming a column across the whole codebase) far riskier without compiler support.

## Consequences

Schema lives in `apps/api/src/database/schema.ts` as plain TypeScript; migrations are generated into `infrastructure/migrations/` and are plain SQL, which makes them easy to review in pull requests. `drizzle-kit generate` runs in CI (see `.github/workflows/ci.yml`) to catch schema/migration drift before merge.

## Revisit conditions

None expected before v1.
