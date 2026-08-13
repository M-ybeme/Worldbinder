# ADR-0013: Application-level revision snapshots

**Status:** Accepted
**Date:** 2026-07-16

## Context

Entities, sessions, and plot threads need browsable page history — see revision N of a page, restore an earlier version — driven from the UI, not a DBA tool. That's a different problem from Postgres's own WAL/point-in-time recovery, which operates on the whole database, not a single row a user can browse and pick from.

## Decision

A dedicated `resource_revisions` table snapshots a resource's full content on each write, tagged with actor, resource type/id, and campaign id. `RevisionRecorderService.shouldMergeRevision()` collapses same-actor edits within a ~30-minute window into a single revision row (`REVISION_WINDOW_MINUTES`), so routine autosave traffic doesn't spam the history with noise — merging requires the same actor, a prior revision to merge into, and staying within the window measured from that revision's own timestamp. `RevisionsService.restore()` always forces a new revision regardless of timing, and re-runs the resource's normal update path rather than a raw row copy, so restoring gets wiki-link refresh, tsvector rebuild, and tag sync for free — a restore can never silently skip a side effect a normal edit gets.

## Alternatives considered

- **Postgres temporal tables / a system-versioning extension**: gives row-level history "for free," but ties revision semantics to the live schema's column shape — a later migration could silently corrupt the meaning of historical rows. It also has no natural place for actor-aware merge-window policy, and doesn't map cleanly onto a "revision N of Y, pick one to restore" UI.
- **Event sourcing (store diffs/ops, replay to reconstruct)**: more storage-efficient, but every read of "content as of revision N" requires replaying, and diff/patch formats for a rich-text JSON tree (ADR-0010) are nontrivial to get right. Full snapshots are simple and cheap at this app's realistic per-campaign content volume.

## Consequences

- Revision storage grows roughly linearly with edit count, bounded per-actor by the merge window — append-only, with no pruning/retention policy yet (a real, documented known limitation, not an oversight).
- Restore is a genuine full read-modify-write through the same service layer used for normal edits, not a special-cased raw copy.

## Revisit conditions

If per-campaign revision volume ever becomes a real storage or query-performance concern, or if a "diff view between two revisions" feature is wanted — the latter would need a text-diff strategy for TipTap JSON specifically, not just a schema change.
