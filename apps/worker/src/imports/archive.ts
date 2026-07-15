import { createHash } from 'node:crypto'
import {
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  ATTACHMENT_MAX_SIZE_BYTES,
  attachmentsFileSchema,
  entitiesFileSchema,
  exportedCampaignSchema,
  looksLikeText,
  manifestSchema,
  mapsFileSchema,
  MAX_IMPORT_ENTRY_COUNT,
  MAX_JSON_ENTRY_SIZE_BYTES,
  membersFileSchema,
  plotThreadsFileSchema,
  relationshipsFileSchema,
  sessionsFileSchema,
  sniffMimeType,
  tagsFileSchema,
  timelineFileSchema,
  wikiLinksFileSchema,
  type ArchiveManifest,
  type ExportedAttachment,
  type ExportedCampaign,
  type ExportedEntity,
  type ExportedMap,
  type ExportedMember,
  type ExportedPlotThread,
  type ExportedSession,
  type ExportedTag,
  type ExportedTimelineEvent,
  type ExportedWikiLink,
  type RelationshipsFile,
} from '@worldbinder/validation'
import AdmZip from 'adm-zip'

export class ValidationFailure extends Error {}

const REQUIRED_JSON_FILES = [
  'manifest.json',
  'campaign.json',
  'members.json',
  'tags.json',
  'entities.json',
  'relationships.json',
  'wiki-links.json',
  'sessions.json',
  'plot-threads.json',
  'maps.json',
  'timeline.json',
  'attachments.json',
  'checksums.json',
] as const

const ATTACHMENT_ENTRY_PATTERN =
  /^attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The "format migration layer" deliverable's extension point — a no-op
 * passthrough today since only one schema version exists. A future schema
 * version would branch here rather than requiring a v1 archive to be
 * rejected outright. */
function migrateArchive(manifest: ArchiveManifest): void {
  if (manifest.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    throw new ValidationFailure(
      `Unsupported archive schema version "${manifest.schemaVersion}" (expected "${ARCHIVE_SCHEMA_VERSION}")`,
    )
  }
}

export interface ParsedArchive {
  manifest: ArchiveManifest
  campaign: ExportedCampaign
  members: ExportedMember[]
  tags: ExportedTag[]
  entities: ExportedEntity[]
  relationships: RelationshipsFile
  wikiLinks: ExportedWikiLink[]
  sessions: ExportedSession[]
  plotThreads: ExportedPlotThread[]
  maps: ExportedMap[]
  timeline: ExportedTimelineEvent[]
  attachmentsMeta: ExportedAttachment[]
  contents: Map<string, Buffer>
}

/** The single implementation of "malicious archives are rejected" —
 * every check fails closed (throws `ValidationFailure`) rather than
 * partially proceeding. Shared by `validateImport()` (dry run) and
 * `runImport()` (which re-parses the same archive independently, since
 * it's a separate job invocation and never trusts a prior job's result
 * without re-verifying). */
export function openArchive(archiveBuffer: Buffer): ParsedArchive {
  let zip: AdmZip
  try {
    zip = new AdmZip(archiveBuffer)
  } catch {
    throw new ValidationFailure('Archive is not a valid zip file')
  }

  const entries = zip.getEntries()
  if (entries.length > MAX_IMPORT_ENTRY_COUNT) {
    throw new ValidationFailure('Archive contains too many entries')
  }

  // Whitelist every entry name — the single check that covers path
  // traversal and symlinks in one pass (no fragile symlink-bit inspection
  // needed): anything not exactly a known top-level file or
  // `attachments/<uuid>` is rejected outright, full stop.
  const knownNames = new Set<string>(REQUIRED_JSON_FILES)
  for (const entry of entries) {
    const name = entry.entryName
    const isKnownFile = knownNames.has(name)
    const isAttachment = ATTACHMENT_ENTRY_PATTERN.test(name)
    if (!isKnownFile && !isAttachment) {
      throw new ValidationFailure(`Archive contains an unexpected entry: "${name}"`)
    }
    if (entry.isDirectory) {
      throw new ValidationFailure(`Archive contains an unexpected directory entry: "${name}"`)
    }

    const declaredSize = entry.header.size
    const cap = isAttachment ? ATTACHMENT_MAX_SIZE_BYTES : MAX_JSON_ENTRY_SIZE_BYTES
    if (declaredSize > cap) {
      throw new ValidationFailure(`Archive entry "${name}" declares a size over the allowed limit`)
    }
  }

  const contents = new Map<string, Buffer>()
  for (const entry of entries) {
    const data = entry.getData()
    const cap = ATTACHMENT_ENTRY_PATTERN.test(entry.entryName)
      ? ATTACHMENT_MAX_SIZE_BYTES
      : MAX_JSON_ENTRY_SIZE_BYTES
    // Defense in depth: re-check the *actual* decompressed size, since a
    // crafted entry could lie in its header (the classic zip-bomb shape).
    if (data.byteLength > cap) {
      throw new ValidationFailure(
        `Archive entry "${entry.entryName}" decompressed beyond the allowed limit`,
      )
    }
    contents.set(entry.entryName, data)
  }

  for (const name of REQUIRED_JSON_FILES) {
    if (!contents.has(name)) {
      throw new ValidationFailure(`Archive is missing required file "${name}"`)
    }
  }

  const manifest = parseJson(contents, 'manifest.json', manifestSchema)
  if (manifest.format !== ARCHIVE_FORMAT) {
    throw new ValidationFailure(`Unrecognized archive format "${manifest.format}"`)
  }
  migrateArchive(manifest)

  // Verify checksums for every file except checksums.json itself.
  const checksums = JSON.parse(contents.get('checksums.json')!.toString('utf8')) as Record<
    string,
    string
  >
  for (const [name, buffer] of contents) {
    if (name === 'checksums.json') continue
    const actual = createHash('sha256').update(buffer).digest('hex')
    if (checksums[name] !== actual) {
      throw new ValidationFailure(`Checksum mismatch for archive entry "${name}"`)
    }
  }

  return {
    manifest,
    campaign: parseJson(contents, 'campaign.json', exportedCampaignSchema),
    members: parseJson(contents, 'members.json', membersFileSchema),
    tags: parseJson(contents, 'tags.json', tagsFileSchema),
    entities: parseJson(contents, 'entities.json', entitiesFileSchema),
    relationships: parseJson(contents, 'relationships.json', relationshipsFileSchema),
    wikiLinks: parseJson(contents, 'wiki-links.json', wikiLinksFileSchema),
    sessions: parseJson(contents, 'sessions.json', sessionsFileSchema),
    plotThreads: parseJson(contents, 'plot-threads.json', plotThreadsFileSchema),
    maps: parseJson(contents, 'maps.json', mapsFileSchema),
    timeline: parseJson(contents, 'timeline.json', timelineFileSchema),
    attachmentsMeta: parseJson(contents, 'attachments.json', attachmentsFileSchema),
    contents,
  }
}

/** Re-runs real content detection on every attachment's bytes — never
 * trusts `attachments.json`'s declared mime type. A mismatch drops that
 * attachment (warning, not a hard failure of the whole archive). Returns
 * the freshly *detected* mime type per surviving attachment (not the
 * archive's declared one) for `runImport()` to store. */
export function detectValidAttachments(
  attachmentsMeta: ExportedAttachment[],
  contents: Map<string, Buffer>,
): { validAttachments: Map<string, string>; warnings: string[] } {
  const warnings: string[] = []
  const validAttachments = new Map<string, string>()

  for (const meta of attachmentsMeta) {
    const bytes = contents.get(`attachments/${meta.id}`)
    if (!bytes) {
      warnings.push(
        `Attachment "${meta.originalFilename}" is missing its file data and will be skipped`,
      )
      continue
    }
    const detected = sniffMimeType(bytes) ?? (looksLikeText(bytes) ? 'text/plain' : null)
    if (!detected) {
      warnings.push(
        `Attachment "${meta.originalFilename}" failed content verification and will be skipped`,
      )
      continue
    }
    validAttachments.set(meta.id, detected)
  }

  return { validAttachments, warnings }
}

function parseJson<T>(
  contents: Map<string, Buffer>,
  name: string,
  schema: { parse: (input: unknown) => T },
): T {
  let raw: unknown
  try {
    raw = JSON.parse(contents.get(name)!.toString('utf8'))
  } catch {
    throw new ValidationFailure(`Archive entry "${name}" is not valid JSON`)
  }
  try {
    return schema.parse(raw)
  } catch {
    throw new ValidationFailure(`Archive entry "${name}" does not match the expected format`)
  }
}
