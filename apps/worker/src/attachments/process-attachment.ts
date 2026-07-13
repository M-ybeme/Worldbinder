import { createHash } from 'node:crypto'
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { looksLikeText, sniffMimeType } from '@worldbinder/validation'
import { imageSize } from 'image-size'
import type { Pool } from 'pg'
import { deleteObjectBestEffort } from '../storage/s3-client'

export interface ProcessAttachmentDeps {
  pool: Pool
  s3: S3Client
  bucket: string
}

/** Plain exported function, not tied to the BullMQ Worker or any DI
 * container — the real job processor calls this, and integration tests
 * call it directly too, bypassing the queue entirely so tests don't need a
 * live BullMQ consumer process running. Same "pure function extracted for
 * testability" spirit as apps/api's shouldMergeRevision. */
export async function processAttachment(
  attachmentId: string,
  deps: ProcessAttachmentDeps,
): Promise<void> {
  const { pool, s3, bucket } = deps

  const { rows } = await pool.query<{ storage_key: string }>(
    'SELECT storage_key FROM attachments WHERE id = $1',
    [attachmentId],
  )
  const row = rows[0]
  if (!row) return // Deleted before processing reached it — nothing to do.

  await pool.query("UPDATE attachments SET status = 'processing' WHERE id = $1", [attachmentId])

  let buffer: Buffer
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }))
    buffer = await streamToBuffer(response.Body)
  } catch {
    // Object genuinely missing (upload never landed despite complete()'s
    // HeadObject check passing moments earlier, or it was swept already) —
    // reject rather than leaving the row stuck in `processing` forever.
    await pool.query("UPDATE attachments SET status = 'rejected' WHERE id = $1", [attachmentId])
    return
  }

  // Real magic-byte detection is authoritative here — the presign-time
  // declared MIME type is advisory only (roadmap §16.2 "do not trust
  // extension or browser MIME type").
  const detected = sniffMimeType(buffer) ?? (looksLikeText(buffer) ? 'text/plain' : null)

  if (!detected) {
    await pool.query("UPDATE attachments SET status = 'rejected' WHERE id = $1", [attachmentId])
    await deleteObjectBestEffort(s3, bucket, row.storage_key)
    return
  }

  let width: number | null = null
  let height: number | null = null
  if (detected.startsWith('image/')) {
    try {
      const size = imageSize(buffer)
      width = size.width
      height = size.height
    } catch {
      // Passed the magic-byte check but image-size couldn't parse it
      // (truncated/corrupt file) — reject rather than storing a
      // dimensionless "ready" image.
      await pool.query("UPDATE attachments SET status = 'rejected' WHERE id = $1", [attachmentId])
      await deleteObjectBestEffort(s3, bucket, row.storage_key)
      return
    }
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex')

  await pool.query(
    `UPDATE attachments
     SET status = 'ready', detected_mime_type = $2, sha256 = $3, width = $4, height = $5, size_bytes = $6
     WHERE id = $1`,
    [attachmentId, detected, sha256, width, height, buffer.byteLength],
  )
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
