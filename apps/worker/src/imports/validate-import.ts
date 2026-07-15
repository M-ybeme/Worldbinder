import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { ImportReport } from '@worldbinder/contracts'
import { MAX_IMPORT_ARCHIVE_SIZE_BYTES } from '@worldbinder/validation'
import type { Pool } from 'pg'
import { detectValidAttachments, openArchive, ValidationFailure } from './archive'

export interface ValidateImportDeps {
  pool: Pool
  s3: S3Client
  bucket: string
}

/** Plain exported function (same "callable directly by tests, bypassing the
 * queue" shape as processAttachment). Downloads and parses the archive via
 * `openArchive()` (the actual "malicious archives are rejected" logic),
 * then produces a dry-run report — never writes campaign data. */
export async function validateImport(importId: string, deps: ValidateImportDeps): Promise<void> {
  const { pool, s3, bucket } = deps

  const { rows } = await pool.query<{ archive_storage_key: string }>(
    'SELECT archive_storage_key FROM campaign_imports WHERE id = $1',
    [importId],
  )
  const row = rows[0]
  if (!row) return

  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: row.archive_storage_key }),
    )
    if ((head.ContentLength ?? 0) > MAX_IMPORT_ARCHIVE_SIZE_BYTES) {
      throw new ValidationFailure('Archive exceeds the maximum allowed size')
    }

    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: row.archive_storage_key }),
    )
    const archiveBuffer = await streamToBuffer(object.Body)

    const archive = openArchive(archiveBuffer)
    const { validAttachments, warnings } = detectValidAttachments(
      archive.attachmentsMeta,
      archive.contents,
    )

    const mapPinCount = archive.maps.reduce((sum, m) => sum + m.pins.length, 0)

    const report: ImportReport = {
      counts: {
        entities: archive.entities.length,
        relationships: archive.relationships.relationships.length,
        wikiLinks: archive.wikiLinks.length,
        sessions: archive.sessions.length,
        plotThreads: archive.plotThreads.length,
        maps: archive.maps.length,
        mapPins: mapPinCount,
        timelineEvents: archive.timeline.length,
        tags: archive.tags.length,
        members: archive.members.length,
        attachments: validAttachments.size,
      },
      warnings,
    }

    await pool.query(
      `UPDATE campaign_imports SET status = 'dry_run_ready', dry_run_report_json = $2 WHERE id = $1`,
      [importId, JSON.stringify(report)],
    )
  } catch (error) {
    const message = error instanceof ValidationFailure ? error.message : String(error)
    await pool.query(
      `UPDATE campaign_imports SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [importId, message],
    )
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
