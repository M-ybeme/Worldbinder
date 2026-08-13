# Export/import archive format

The versioned, schema-independent campaign export format (roadmap §17, [ADR-0017](../decisions/0017-versioned-export-format.md)). The real implementation (`packages/validation/src/import-export.ts` for the schemas, `apps/worker/src/exports/export-campaign.ts` for producing an archive, `apps/worker/src/imports/archive.ts` and `validate-import.ts` for consuming one) is the source of truth this document describes — it's a superset of the roadmap's §17.1/§17.2 skeleton, documented here in full since the roadmap only specified the file layout, not every field.

## Archive layout

A zip file containing:

```text
manifest.json
campaign.json
members.json
tags.json
entities.json
relationships.json
wiki-links.json
sessions.json
plot-threads.json
maps.json
timeline.json
attachments.json       (deviation from §17.1 — see below)
checksums.json
attachments/
  <attachment-uuid>    (raw file bytes, one entry per ready attachment, no extension)
```

**One documented deviation from §17.1's literal file list**: `attachments.json` holds attachment metadata (original filename, declared MIME type, size, hash, dimensions, visibility, and which resources it's linked to) alongside the `attachments/` folder of raw bytes — the roadmap's file list has nowhere else to put that metadata, since the raw bytes folder alone can't carry it.

## Manifest (`manifest.json`)

```json
{
  "format": "worldbinder-campaign",
  "schemaVersion": "1.0.0",
  "applicationVersion": "1.0.0",
  "exportedAt": "2026-07-10T00:00:00Z",
  "campaignId": "uuid"
}
```

`format` and `schemaVersion` are checked exactly on import (`ARCHIVE_FORMAT`/`ARCHIVE_SCHEMA_VERSION`, `packages/validation`) — a mismatch on either is a hard rejection today. `migrateArchive()` in `apps/worker/src/imports/archive.ts` is the intended future extension point for supporting older schema versions (a real archive-migration step), currently a no-op passthrough since only one version has ever existed.

## What each file contains

- **`campaign.json`** — name, description, system name, settings, current world date, calendar config. Not the campaign's id/slug/status/ownership — those are properties of the _new_ campaign import creates, not carried over.
- **`members.json`** — role and display name only, **never emails** (roadmap §17.1's explicit privacy requirement). Exported for historical reference; not re-imported as live `campaign_members` rows — import always creates a fresh campaign owned by the importing user, who becomes its sole member.
- **`tags.json`** — id/name pairs, remapped to new ids on import.
- **`entities.json`** — every entity's full content (both `publicContentJson` and `gmContentJson` — an export is a GM-level operation, so nothing is filtered by visibility the way an API response would be), metadata, status, visibility, and tag names.
- **`relationships.json`** — `{ customTypes, relationships }`. Built-in relationship types (stable ids seeded identically in every database, `built-in-relationship-types.ts`) are **never included** — only custom per-campaign types are exported and remapped; built-in ids are assumed to already exist in the target database.
- **`wiki-links.json`** — extracted mentions, `sourceResourceType` always `'entity'` today (a real, current constraint of `entity_wiki_links`, not an export-format limitation) — only the entity id map is needed to remap both ends on import.
- **`sessions.json`** — full session content including `gmContentJson`. Participants (which reference `campaign_members`, not entities) are deliberately omitted — there's no live membership to link them to in a freshly-imported campaign.
- **`plot-threads.json`**, **`maps.json`** (with nested layers/pins), **`timeline.json`** — each resource's full content plus the entity/session ids it references, remapped on import the same way relationships are.
- **`attachments.json`** + **`attachments/`** — metadata plus raw bytes for every attachment whose `status` was `ready` at export time.
- **`checksums.json`** — a SHA-256 hash per file (except itself), verified on import before anything else is trusted.

## Security defenses on import

`openArchive()` (`apps/worker/src/imports/archive.ts`) is the single implementation of "malicious archives are rejected" — every check fails closed, and both the dry-run validation path and the real import path call it independently (the import job never trusts a prior dry-run job's result without re-verifying, since it's a separate job invocation):

1. **Entry-count cap** (`MAX_IMPORT_ENTRY_COUNT`, 10,000) — rejected before any entry is even read.
2. **Whitelist every entry name** — the single check that covers path traversal _and_ symlinks at once: anything that isn't exactly one of the known top-level files or an `attachments/<uuid>`-shaped name (validated by regex, no extension) is rejected outright. No fragile symlink-bit inspection needed, because nothing outside the whitelist is ever opened.
3. **No directory entries allowed.**
4. **Per-file size caps** (`MAX_JSON_ENTRY_SIZE_BYTES` for JSON, `ATTACHMENT_MAX_SIZE_BYTES` for attachment bytes).
5. **Checksum verification** — every file's SHA-256 must match `checksums.json` before its contents are parsed at all.
6. **Schema validation** — every JSON file is parsed against its real Zod schema (the same schemas listed above); a shape mismatch is a hard rejection, not a best-effort partial import.
7. **Content re-verification on attachments** — `sniffMimeType`/`looksLikeText` re-check actual file bytes rather than trusting the archive's declared MIME type, the same magic-byte discipline `apps/worker`'s live attachment-processing job uses.

## Import sequence

Upload → presign (`presignImportSchema` caps declared size) → `openArchive()` validation (above) → a dry-run report the user must confirm before anything is written → id remapping (every id in the archive gets a fresh uuid; only built-in relationship-type ids pass through unchanged) → import inside a database transaction, committing only once every required record succeeds → attachments re-uploaded to new storage keys → a final import report. This mirrors the roadmap's §17.3 sequence; the real code additionally re-validates independently at the actual-import step rather than trusting the earlier dry-run job's output, per point 1 above.

## Why re-import goes through the real service layer, not raw inserts

Consistent with the demo-content script precedent (`CLAUDE.md`): import doesn't trust archive data as a guaranteed-clean backup, because it isn't one — it's untrusted input the moment it's re-uploaded by anyone, including the original exporter's own possibly-tampered-with copy. The defenses above exist specifically because of that, not as defense-in-depth for a threat that isn't real.
