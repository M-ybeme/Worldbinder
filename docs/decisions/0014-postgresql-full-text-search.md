# ADR-0014: PostgreSQL full-text search

**Status:** Accepted
**Date:** 2026-07-16

## Context

Search needs to be fast across entities, sessions, plot threads, and timeline events, ranked across name/alias/summary/content, and must respect `public`/`gm_only` visibility per result — a search that leaks a `gm_only` entity's existence to a player is a security failure, not a UX one (§2.2). Realistic per-campaign document count is dozens to low hundreds, not a scale that needs a dedicated search engine.

## Decision

Native Postgres `tsvector` columns, split per visibility tier (`searchVectorPublic` / `searchVectorGm`, maintained at write time by `search-vector.util.ts`) with GIN indexes, plus `pg_trgm` GIN trigram indexes on name/title columns for fuzzy, typo-tolerant matching. `SearchService` queries both, ranked through a tiered scheme (exact name, exact alias, name prefix, ...) rather than a single opaque relevance score.

## Alternatives considered

- **Elasticsearch or another dedicated search engine**: far more powerful ranking and faceting, but a whole extra service to run, back up, and keep in sync with Postgres — a dual-write consistency risk — for a product whose document counts never approach the scale where Postgres FTS is the bottleneck. Rejected for the same "deep, not broad" / technology-coherence reasoning as ADR-0011's graph-database rejection.
- **A client-side search index (e.g. Fuse.js against a fetched dataset)**: doesn't scale to eventual campaign sizes, and — more importantly — can't enforce `gm_only` filtering server-side. Filtering results after fetching them client-side would mean hidden content transits the network to an unauthorized client at all, which the product's own visibility principle explicitly forbids.

## Consequences

- Search relevance tuning is hand-rolled (the tier constants in `search.service.ts`) rather than a mature ranking algorithm — adequate at this product's scale; revisit if it ever isn't.
- Splitting `tsvector` at the column level (public vs. gm) is what lets an unauthorized search simply not query the gm column, rather than filtering results after the fact — this directly serves "hidden content must not be... included in search results" (§2.2), not just as an implementation detail but as the actual enforcement mechanism.

## Revisit conditions

If per-campaign content volume or search sophistication needs (e.g. semantic/embedding-based search) ever outgrow Postgres FTS, revisit — likely additive (a second search path) rather than a wholesale replacement, given how deeply visibility enforcement is tied to the current column design.
