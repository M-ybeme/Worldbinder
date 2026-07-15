import { createHash } from 'node:crypto'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import {
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  MAX_IMPORT_ENTRY_COUNT,
} from '@worldbinder/validation'
import AdmZip from 'adm-zip'
import { describe, expect, it, vi } from 'vitest'
import { validateImport } from './validate-import'

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

interface ArchiveOptions {
  manifestOverrides?: Record<string, unknown>
  attachmentBytes?: Buffer | null
  extraEntries?: { name: string; data: Buffer }[]
  tamperChecksum?: string
  skipChecksumFor?: string[]
}

const ATTACHMENT_ID = '11111111-1111-1111-1111-111111111111'

function buildArchive(options: ArchiveOptions = {}): Buffer {
  const zip = new AdmZip()
  const checksums: Record<string, string> = {}

  const addJson = (name: string, data: unknown) => {
    const buf = Buffer.from(JSON.stringify(data), 'utf8')
    zip.addFile(name, buf)
    if (!options.skipChecksumFor?.includes(name)) {
      checksums[name] = createHash('sha256').update(buf).digest('hex')
    }
  }

  const manifest = {
    format: ARCHIVE_FORMAT,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    applicationVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    campaignId: '22222222-2222-2222-2222-222222222222',
    ...options.manifestOverrides,
  }
  addJson('manifest.json', manifest)
  addJson('campaign.json', {
    name: 'Test Campaign',
    description: null,
    systemName: null,
    settingsJson: null,
    currentWorldDateJson: null,
    calendarConfigJson: null,
  })
  addJson('members.json', [])
  addJson('tags.json', [])
  addJson('entities.json', [])
  addJson('relationships.json', { customTypes: [], relationships: [] })
  addJson('wiki-links.json', [])
  addJson('sessions.json', [])
  addJson('plot-threads.json', [])
  addJson('maps.json', [])
  addJson('timeline.json', [])

  const attachmentBytes =
    options.attachmentBytes === undefined ? VALID_PNG : options.attachmentBytes
  const attachmentsMeta = attachmentBytes
    ? [
        {
          id: ATTACHMENT_ID,
          originalFilename: 'fixture.png',
          declaredMimeType: 'image/png',
          sizeBytes: attachmentBytes.byteLength,
          sha256: createHash('sha256').update(attachmentBytes).digest('hex'),
          width: 1,
          height: 1,
          visibility: 'public',
          resourceLinks: [],
        },
      ]
    : []
  addJson('attachments.json', attachmentsMeta)
  if (attachmentBytes) {
    const entryName = `attachments/${ATTACHMENT_ID}`
    zip.addFile(entryName, attachmentBytes)
    if (!options.skipChecksumFor?.includes(entryName)) {
      checksums[entryName] = createHash('sha256').update(attachmentBytes).digest('hex')
    }
  }

  for (const extra of options.extraEntries ?? []) {
    zip.addFile(extra.name, extra.data)
    checksums[extra.name] = createHash('sha256').update(extra.data).digest('hex')
  }

  if (options.tamperChecksum) {
    checksums[options.tamperChecksum] = 'deadbeef'.repeat(8)
  }

  zip.addFile('checksums.json', Buffer.from(JSON.stringify(checksums), 'utf8'))
  return zip.toBuffer()
}

function fakePool() {
  const queries: { sql: string; params: unknown[] }[] = []
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (sql.includes('SELECT archive_storage_key')) {
      return { rows: [{ archive_storage_key: 'imports/fixture.zip' }] }
    }
    return { rows: [] }
  })
  return { query, queries }
}

function fakeS3(archiveBuffer: Buffer) {
  return {
    send: vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return { ContentLength: archiveBuffer.byteLength }
      }
      if (command instanceof GetObjectCommand) {
        return {
          Body: (async function* () {
            yield archiveBuffer
          })(),
        }
      }
      throw new Error('unexpected command')
    }),
  }
}

async function run(archiveBuffer: Buffer) {
  const pool = fakePool()
  const s3 = fakeS3(archiveBuffer)
  await validateImport('import-id', { pool: pool as never, s3: s3 as never, bucket: 'b' })
  return pool.queries
}

function statusOf(queries: { sql: string; params: unknown[] }[]) {
  const call = queries.find((q) => q.sql.includes('UPDATE campaign_imports'))
  return { call, status: call?.sql.includes("status = 'failed'") ? 'failed' : 'dry_run_ready' }
}

describe('validateImport', () => {
  it('accepts a well-formed archive and produces a dry-run report', async () => {
    const queries = await run(buildArchive())
    const { status, call } = statusOf(queries)
    expect(status).toBe('dry_run_ready')
    const report = JSON.parse(call!.params[1] as string) as { counts: Record<string, number> }
    expect(report.counts.attachments).toBe(1)
  })

  it('rejects an archive containing a path-traversal entry name', async () => {
    const archive = buildArchive({
      extraEntries: [{ name: '../../etc/passwd', data: Buffer.from('nope') }],
    })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/unexpected entry/i)
  })

  it('rejects an archive containing a non-whitelisted entry name', async () => {
    const archive = buildArchive({
      extraEntries: [{ name: 'malicious.sh', data: Buffer.from('#!/bin/sh\nrm -rf /') }],
    })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/unexpected entry/i)
  })

  it('rejects an archive whose entry count exceeds the cap', async () => {
    const extraEntries = Array.from({ length: MAX_IMPORT_ENTRY_COUNT + 1 }, (_, i) => ({
      name: `attachments/${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
      data: Buffer.from('x'),
    }))
    const archive = buildArchive({ extraEntries, attachmentBytes: null })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/too many entries/i)
  })

  it('rejects an archive with a tampered checksum', async () => {
    const archive = buildArchive({ tamperChecksum: 'entities.json' })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/checksum mismatch/i)
  })

  it('rejects an archive missing a checksum for one of its files', async () => {
    const archive = buildArchive({ skipChecksumFor: ['entities.json'] })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/checksum mismatch/i)
  })

  it('rejects an unsupported schema version', async () => {
    const archive = buildArchive({ manifestOverrides: { schemaVersion: '99.0.0' } })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/schema version/i)
  })

  it('rejects an unrecognized archive format', async () => {
    const archive = buildArchive({ manifestOverrides: { format: 'something-else' } })
    const { status, call } = statusOf(await run(archive))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/format/i)
  })

  it('rejects bytes that are not a valid zip file at all', async () => {
    const { status, call } = statusOf(await run(Buffer.from('not a zip file')))
    expect(status).toBe('failed')
    expect(call!.params[1]).toMatch(/not a valid zip/i)
  })

  it('drops an attachment whose real content does not match its declared type, but still validates', async () => {
    const executableBytes = Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0])
    const archive = buildArchive({ attachmentBytes: executableBytes })
    const queries = await run(archive)
    const { status, call } = statusOf(queries)
    expect(status).toBe('dry_run_ready')
    const report = JSON.parse(call!.params[1] as string) as {
      counts: Record<string, number>
      warnings: string[]
    }
    expect(report.counts.attachments).toBe(0)
    expect(report.warnings.some((w) => /failed content verification/i.test(w))).toBe(true)
  })
})
