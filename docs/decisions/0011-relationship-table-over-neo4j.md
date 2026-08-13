# ADR-0011: Relationship table over Neo4j

**Status:** Accepted
**Date:** 2026-07-16

## Context

Relationships between entities are first-class data (roadmap §2.1) — typed, directed connections (ally of, member of, guards, ...) that need to be queryable, visibility-gated (`public`/`gm_only`), and surfaced as backlinks on an entity's page. Campaign scale is realistically dozens to a few hundred entities and relationships per campaign, and the product's own UI only ever needs direct relationships plus one level of backlinks (§9) — nowhere near deep-graph-traversal territory.

## Decision

Model relationships as a plain Postgres table, `entity_relationships` (`source_entity_id`, `target_entity_id`, `relationship_type_id`, `visibility`, `search_vector`), alongside a `relationship_types` table holding the label vocabulary (14 built-in types seeded with fixed ids, plus custom per-campaign types) — not a separate graph database.

## Alternatives considered

- **Neo4j or another graph database**: excellent for deep traversal (shortest path, N-hop reachability), but this product needs none of that — the UI never asks "how are these two characters connected across five hops." Adopting one would mean a second datastore to keep transactionally consistent with entities and their visibility rules, doubling operational complexity (a second backup story, a second connection pool, a second ORM/driver) for a capability nothing in the roadmap uses. Rejected per the roadmap's own "deep, not broad" (§2.5) and "technology choices must be coherent" (§2.6) principles.
- **Recursive CTEs over the same Postgres table, only if deep traversal is ever needed**: kept as the fallback path rather than reaching for a new datastore — see Revisit conditions.

## Consequences

- Relationship queries are simple indexed joins scoped by `campaign_id`, sharing the same transaction, backup, and tenancy story (ADR-0015) as every other resource.
- No multi-hop graph traversal exists today, and none is easy to build efficiently at real scale without recursive CTEs — not attempted, since nothing currently needs it.

## Revisit conditions

If the product ever needs genuine multi-hop graph queries (e.g. "show the shortest connection between two characters") at a scale where recursive CTEs become impractical, revisit — but only once that's a real, roadmap-driven requirement, not speculatively.
