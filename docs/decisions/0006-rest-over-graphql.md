# ADR-0006: REST over GraphQL

**Status:** Accepted
**Date:** 2026-07-10

## Context

The API surface maps cleanly onto resources (campaigns, entities, sessions, plot threads) with conventional CRUD plus a handful of workflow actions (session completion, revision restore, export/import). The project also needs straightforward permission testing, HTTP caching, and monitoring.

## Decision

Use REST with OpenAPI documentation generated from NestJS controller metadata.

## Alternatives considered

- **GraphQL:** Would help if clients needed to select arbitrary nested fields across relationships in a single request, but no current workflow requires that. GraphQL also complicates field-level authorization (see roadmap §13.2) — a REST serializer can omit a field outright, where a GraphQL resolver has to enforce the same rule per-field, per-query-shape. It also adds a second query language and caching model to reason about for no proven benefit here.

## Consequences

Every new resource gets conventional REST routes (see roadmap §18.3 for representative examples). If a future screen genuinely needs deeply nested, client-selected data (e.g. a campaign overview combining many resource types), it can be served by a purpose-built aggregation endpoint rather than introducing GraphQL wholesale.

## Revisit conditions

Revisit only if a specific screen's data-fetching needs cannot be reasonably served by REST aggregation endpoints, and that becomes a recurring pattern rather than a one-off.
