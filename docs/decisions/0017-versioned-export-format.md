# ADR-0017: Versioned export format

**Status:** Accepted
**Date:** 2026-07-16

## Context

Roadmap §2.4 commits to users owning their campaign data: a complete campaign must be exportable and restorable, in a format that stays valid even as the live database schema evolves — an export tied to today's schema would stop being importable the moment a later migration changes a column.

## Decision

A zip archive with a top-level `manifest.json` carrying an explicit `schemaVersion` (`ARCHIVE_SCHEMA_VERSION`, `packages/validation`), per-resource-type JSON files, and a raw `attachments/` folder of file bytes alongside an `attachments.json` metadata file — a documented deviation from the roadmap's literal §17.1 file list, added because that list has nowhere else to put attachment metadata. Import (`apps/worker/src/imports/archive.ts`) checks `manifest.schemaVersion` against `ARCHIVE_SCHEMA_VERSION` up front and refuses anything that doesn't match exactly — no forward/backward-compatible parsing exists yet.

## Alternatives considered

- **Raw database dumps** (`pg_dump` of relevant rows): trivial to produce, but ties the export format directly to the live schema's column names and types — any future migration would silently break every previously-exported archive's importability. This would directly violate §2.4's "independent of the production database schema" requirement, not just make it harder.
- **A single flat JSON file for everything**: simpler than a multi-file zip, but attachments are binary and don't belong inlined/base64-encoded into a JSON blob at any realistic file size.

## Consequences

- Any future schema change affecting an exported resource type needs either a `schemaVersion` bump plus (eventually) a migration path between archive versions, or an explicit decision that old exports become unimportable — not yet needed, since only one version has ever existed.
- Import re-validates and re-derives everything through the real service layer on the way back in (the same "real HTTP/service layer, not raw inserts" precedent the demo-content script follows) rather than trusting the archive's data blindly — checksum, whitelist, and content-re-verification defenses exist specifically because a re-imported archive is untrusted input, not a guaranteed-clean backup.

## Revisit conditions

Once a second `schemaVersion` is ever actually needed, this forces a real decision: support importing older archive versions, or require re-export from a live campaign first. Not a decision to make speculatively now.
