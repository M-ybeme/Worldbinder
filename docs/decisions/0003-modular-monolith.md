# ADR-0003: Modular monolith over microservices

**Status:** Accepted
**Date:** 2026-07-10

## Context

Worldbinder has many domains (auth, campaigns, entities, relationships, sessions, plot threads, search, revisions, attachments, maps, timeline, import/export), but this is a single-maintainer project with no independent scaling requirements at v1.

## Decision

Deploy the API as one NestJS application with clearly separated modules under `apps/api/src/`. The worker (`apps/worker`) runs as a second process against the same database, not as an independently deployed service with its own data store.

## Alternatives considered

- **Microservices per domain:** Would multiply deployment, networking, and transactional complexity for no product benefit at this scale, and would slow down solo development substantially.
- **Single undifferentiated module:** Would erode the domain boundaries the roadmap depends on (e.g. campaign-scoped tenancy, authorization policy separation) as the codebase grows.

## Consequences

Transactions that span domains (e.g. completing a session and advancing plot threads) can use a single database transaction instead of distributed-transaction patterns. Extraction into a separate service later remains possible because module boundaries are enforced now, but is not a v1 goal.

## Revisit conditions

Revisit only if a specific module (e.g. attachment processing or search indexing) develops operational requirements — scaling, language, or failure isolation — that the monolith cannot reasonably satisfy.
