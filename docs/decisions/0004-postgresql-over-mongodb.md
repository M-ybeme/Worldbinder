# ADR-0004: PostgreSQL over MongoDB

**Status:** Accepted
**Date:** 2026-07-10

## Context

Campaign data is highly relational: entities have typed relationships to other entities, sessions link to entities and plot threads, permissions depend on campaign membership, and revisions must reference specific resources. The data also benefits from full-text and trigram search (see the roadmap's search design), which PostgreSQL supports natively.

## Decision

Use PostgreSQL as the primary datastore for all campaign data.

## Alternatives considered

- **MongoDB:** Would fit the semi-structured entity metadata well, but relationships, campaign-scoped tenancy, and multi-table transactions (session completion, plot-thread advancement) are much more natural in a relational database with foreign keys and transactions. Search would also require a separate index (Atlas Search or similar) rather than PostgreSQL's built-in `tsvector`/`pg_trgm`.
- **Graph database (Neo4j):** Considered for the relationship graph specifically, but explicitly rejected as a non-goal (see roadmap §4) to avoid operating a second piece of database infrastructure for a relationship graph that a `entity_relationships` join table handles adequately at this scale.

## Consequences

Entity type-specific fields are stored in `JSONB` columns rather than a flexible document schema, with normalization for anything that needs foreign keys, filtering, or uniqueness (see roadmap §9.3). This is a deliberate middle ground, not a compromise forced by the database choice.

## Revisit conditions

None expected before v1.
