# Known limitations

An honest, consolidated account of what Worldbinder doesn't do yet, gathered from across the codebase's own documentation (ADRs, threat model, authorization model, testing strategy, accessibility statement) rather than left scattered — each item links back to where it's discussed in more depth. Not a bug list; these are scope boundaries, deliberate v1 simplifications, or infrastructure not yet provisioned.

## Account and data management

- **No self-service account deletion.** If you want your account and data removed, it's currently a manual, developer-mediated process — ask directly (see `docs/legal/privacy-policy.md` §6). A self-service flow is expected before any public release, not built yet.
- **Ownership transfer is unimplemented.** A campaign's owner can only be removed by deleting the campaign itself; no operation can promote another member to owner or demote the current one ([ADR-0008](../decisions/0008-campaign-scoped-authorization.md)).
- **Soft-deleted rows are never purged.** Most resources use soft deletion (`deletedAt`) for recoverability, but nothing automatically purges old soft-deleted rows — they persist indefinitely ([ADR-0016](../decisions/0016-soft-deletion.md)).
- **Revision history is never pruned.** `resource_revisions` grows roughly linearly with edit count, bounded per-actor by a merge window, but nothing ever deletes old revisions ([ADR-0013](../decisions/0013-application-level-revision-snapshots.md)).

## Permissions

- **Two permission-matrix cells default to their safer option rather than being configurable.** Player entity-editing ("Optional" in the roadmap's §5.6 matrix) and editor export access ("Configurable") both currently resolve to their stricter default (players read-only, export owner/GM-only) since no per-campaign toggle exists yet — see `docs/security/authorization-model.md`.

## Editing and drafts

- **IndexedDB local drafts don't sync across devices.** Editing the same entity from two browsers can leave each with its own divergent local draft; no cross-device reconciliation exists, and abandoned drafts have no expiry beyond a successful save clearing them ([ADR-0019](../decisions/0019-indexeddb-local-drafts.md)).

## Import/export

- **Only one archive schema version has ever existed.** `schemaVersion` checking and a `migrateArchive()` extension point exist, but no actual migration path between versions has ever been built or tested, since there's never been a second version to migrate from ([ADR-0017](../decisions/0017-versioned-export-format.md)).

## Accessibility

- **Not a formally audited or certified accessibility compliance level.** Milestone 13 fixed every concrete gap its own manual audit found and targets WCAG 2.2 AA, but no automated `axe` scan and no testing with real assistive technology (NVDA/JAWS/VoiceOver) has been performed — see `docs/planning/accessibility-statement.md` for the full honest account.
- **Desktop and tablet only.** No mobile/phone layout or testing exists.
- **`packages/ui` has no lint step of its own** — its components are only linted where consumed by `apps/web`.

## Testing

- **No enforced coverage threshold.** Test coverage is judged by review, not a numeric CI gate.
- **No visual-regression/screenshot-diff testing.**
- **No load/performance testing runs in CI.** The Milestone 14 load-test harnesses (`apps/api/src/load-test/`, `apps/worker/src/load-test/`) are run manually against a local stack, not on every push.
- **The Playwright e2e suite isn't wired into CI** — it needs the full multi-process dev stack running, which CI doesn't currently orchestrate; run it locally before a release (`docs/testing/testing-strategy.md`).

## Infrastructure and hosting

- **No production infrastructure is provisioned yet.** No Railway project, no `worldbinder.net` DNS, no Resend account, no Sentry project exist as of this document — Milestone 16's own not-yet-started job (`docs/runbooks/deployment.md`).
- **Cloudflare R2's real-world S3-API compatibility hasn't been exercised.** The storage layer is written against the S3 API generically ([ADR-0012](../decisions/0012-s3-compatible-storage.md)); R2-specific quirks (multipart/ACL differences from real AWS S3) would only surface once actually pointed at a real R2 bucket.
- **Backup/restore has only been rehearsed locally**, against docker-compose Postgres, never against a real hosted instance (`docs/runbooks/backup-restore.md`) — the live drill is part of Milestone 16's checklist.
- **No in-app feedback, bug-report, or support-contact UI exists.** Sentry is wired in but inert until a real `SENTRY_DSN` is set. Both are deliberate Milestone 15 scope decisions (in-person moderated beta doesn't need them yet), not oversights — see `docs/product/beta-release-notes.md`.

## What this list is not

This isn't a list of bugs to fix opportunistically — several of these (ownership transfer, per-campaign permission toggles, cross-device draft sync) are real future features, not defects, and the roadmap's Milestone 16 release-blocker list (data loss, unauthorized disclosure, broken export/import round trip, broken password recovery, inaccessible primary workflow, failed backups, unhandled migration failure, critical runtime errors) is the actual bar for shipping — none of the items above cross it.

---

_Last updated: 2026-08-12, as part of Milestone 16's documentation pass._
