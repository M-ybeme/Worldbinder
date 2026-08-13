# ADR-0016: Soft deletion

**Status:** Accepted
**Date:** 2026-07-16

## Context

Worldbinder is continuity software — losing a GM's session's worth of work to a misclick would be a real trust failure, and "no unresolved data-loss defect" is a literal Milestone 16 release blocker. Most campaign resources (entities, sessions, plot threads, attachments) need to support recovering from an accidental delete.

## Decision

A nullable `deletedAt` timestamp column on soft-deletable resource tables (per `schema.ts`), with reads filtered by `isNull(deletedAt)` rather than actually removing rows. Two documented exceptions hard-delete instead, per the roadmap's own literal column lists (§9.12, §9.13) and already flagged in `schema.ts`'s comments: `maps` and `timelineEvents` have no `deletedAt` column at all.

## Alternatives considered

- **Hard delete only, no recovery**: simplest, but directly conflicts with the product's core promise of trustworthy continuity, and with Milestone 16's explicit release-blocker list.
- **A separate deleted-items/trash table**: keeps live tables smaller, but doubles the schema surface (every soft-deletable resource needs a mirror table) and complicates restore logic. A nullable column keeps a resource's full identity — including its revision history (ADR-0013) — attached to one row, so undeleting doesn't require reattaching orphaned history.

## Consequences

- Every query against a soft-deletable table must remember the `isNull(deletedAt)` filter — the same "easy to forget, real bug if missed" shape as the tenancy filter (ADR-0015), and audited alongside it in practice.
- No automatic purge or retention policy exists yet for soft-deleted rows — they remain indefinitely. This is a real, documented known limitation (see `docs/product/known-limitations.md`), not an oversight.
- `maps` and `timelineEvents` are the deliberate exception, hard-deleted per the roadmap's literal schema spec — a genuine inconsistency in the model, called out explicitly rather than silently different.

## Revisit conditions

If storage growth from indefinitely-retained soft-deleted rows ever becomes a real operational concern, add a retention/purge policy — that changes the cleanup story, not the soft-delete mechanism itself.
