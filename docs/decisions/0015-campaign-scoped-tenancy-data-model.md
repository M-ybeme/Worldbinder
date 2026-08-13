# ADR-0015: Campaign-scoped tenancy (data model)

**Status:** Accepted
**Date:** 2026-07-16

## Context

Distinct from [ADR-0008](0008-campaign-scoped-authorization.md), which decides _how tenancy is enforced_ (guard chain plus policy service) — this ADR is about the underlying data-modeling decision those guards enforce: how multi-tenancy is represented in the schema at all. Campaigns aren't independently-scaled customers; they're a partitioning key inside one product, at a scale (potentially many small campaigns per install) where heavier isolation strategies buy little.

## Decision

A single shared Postgres schema and database for every campaign. Every campaign-owned table carries a `NOT NULL campaign_id` foreign key with `onDelete: 'cascade'`, and every query is expected to filter by it — enforced in practice at the guard layer (ADR-0008). No schema-per-tenant, no database-per-tenant.

## Alternatives considered

- **Schema-per-tenant** (one Postgres schema per campaign): stronger physical isolation, but migrations would need to run once per existing campaign schema instead of once globally, connection pooling becomes awkward at scale, and it's overkill for a product where a campaign is a partitioning key, not an independently-scaled customer.
- **Database-per-tenant**: the same objections, magnified — impractical for a product that could realistically host thousands of small campaigns per install.

Both rejected in favor of application-level filtering, consistent with ADR-0004's Postgres choice and ADR-0003's modular-monolith preference against engineering for scale this product doesn't have.

## Consequences

- Every new table needs a `campaignId` column and the discipline (guard-enforced per ADR-0008) to always filter by it — a single missed filter is a real tenant-isolation bug, which is exactly why Milestone 14 Phase 1's security audit specifically checked every controller for it.
- Cross-campaign queries (e.g. a future admin view spanning campaigns) are a trivial SQL query, unlike schema- or database-per-tenant.
- One Postgres instance and one backup/restore story (`docs/runbooks/backup-restore.md`) covers every campaign — a simpler operations story than per-tenant infrastructure would require.

## Revisit conditions

If a customer ever needs contractually-guaranteed physical data isolation (e.g. an enterprise or compliance requirement), that would justify schema- or database-per-tenant for that one tenant specifically — not a wholesale redesign of the shared model.
