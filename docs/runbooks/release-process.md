# Release process

Formalizes the versioning and commit convention already in practice since Milestone 0 — this document describes what the project already does, not a new process being introduced.

## Versioning

Pre-1.0, `0.MINOR.PATCH` (`CHANGELOG.md`'s own header, Keep a Changelog + Semantic Versioning):

- **`MINOR`** bumps for any user-visible or structural change — in practice, this project bumps `MINOR` when a milestone (or a significant phase within one) completes. Example: `0.16.0` closed out Milestone 15.
- **`PATCH`** bumps for a smaller change within a milestone that doesn't warrant its own minor version — in practice, each phase of a multi-phase milestone typically gets its own patch version (`0.16.1` through `0.16.5` for Milestone 16's docs-and-regression phases) so the CHANGELOG's history stays granular and each phase is independently referenceable from the roadmap's `[Done — see x.x.x]` markers.
- **No version bump** ("hotfix") for a change that doesn't fit the current phase sequence — e.g. a cross-cutting documentation update discovered mid-milestone. Recorded as an `[Unreleased]` CHANGELOG entry and a `hotfix — description` commit instead of claiming a phase number it isn't part of.

## Commit messages

Two accepted formats, enforced by convention (not a commit-msg hook):

- **`x.x.x — description`** — a version-bumped change. The subject line states the version and a short description; the body explains what changed and why in more detail. Example: `0.16.3 — Milestone 16 Phase 3: architecture and data-model documentation`.
- **`hotfix — description`** — no version bump. Same body-detail expectation, different subject prefix.

Never `--amend` a pushed commit; never force-push to `master`. Each change gets a new commit, even a small follow-up fix to something committed minutes earlier.

## CHANGELOG discipline

`CHANGELOG.md`'s own header states its own rule: "an honest record of what actually shipped, not a restatement of the roadmap's aspirations — if something was attempted and reverted, or shipped partially, say so." In practice:

- Every push adds a CHANGELOG entry — enforced by `.claude/hooks/changelog-check-on-push.mjs`, which blocks `git push` if the commits being pushed don't touch `CHANGELOG.md`.
- New entries go under `## [Unreleased]` if no version bump applies yet, or under a new `## [x.x.x] - YYYY-MM-DD` heading (today's real date, not a placeholder) directly below `[Unreleased]`.
- **Historical entries are never rewritten to reflect later knowledge.** If a decision that was genuinely open at the time (e.g. "Resend or Postmark, undecided") is later finalized, the historical entry describing that milestone's actual scope stays as written — a new entry records the later decision, with a forward/backward cross-reference in prose if useful, but the old entry isn't edited to look like the decision was already known.
- A milestone's roadmap phase notes get a `[Done — see x.x.x]` marker once complete, pointing at the CHANGELOG entry (and therefore the commit) where that phase actually shipped — so "what's done" is always traceable to a real commit, not just an assertion in the roadmap text.

## Milestone completion

A milestone is considered done once every phase in its `### Phases (...)` roadmap section is marked `[Done — see x.x.x]`, its exit criteria (where the roadmap defines any) are addressed and honestly assessed — including naming what wasn't formally verified, not just what was fixed (see Milestone 13's exit-criteria status note as the pattern to follow) — and the full regression pass (`docs/testing/testing-strategy.md`) is clean. The milestone-closing commit gets the `MINOR` version bump.

## What this project does not yet have

No release-candidate/staging promotion process (no staging environment exists — Milestone 16's own infrastructure track). No automated changelog generation from commit messages — entries are written by hand, deliberately, since the whole point is an honest account of what shipped, which a mechanical commit-message-to-changelog transform can't produce on its own. No git tags per release yet; the CHANGELOG heading is the canonical version record.
