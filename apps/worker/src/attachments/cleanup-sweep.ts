import type { S3Client } from '@aws-sdk/client-s3'
import type { Pool } from 'pg'
import { deleteObjectBestEffort } from '../storage/s3-client'

const ABANDONED_AFTER_HOURS = 24 // documented judgment call, same spirit as REVISION_WINDOW_MINUTES

export interface CleanupSweepDeps {
  pool: Pool
  s3: S3Client
  bucket: string
}

/** Plain exported function (same "callable directly by tests, bypassing
 * the queue" shape as processAttachment) — sweeps attachments abandoned
 * mid-pipeline: a presign that was never uploaded, or a worker crash that
 * left a row stuck in `processing` (roadmap §16.2 "remove abandoned
 * pending uploads"). */
export async function cleanupAbandonedAttachments(deps: CleanupSweepDeps): Promise<number> {
  const { pool, s3, bucket } = deps

  const { rows } = await pool.query<{ id: string; storage_key: string }>(
    `SELECT id, storage_key FROM attachments
     WHERE status IN ('pending', 'uploaded', 'processing')
       AND created_at < now() - ($1 || ' hours')::interval`,
    [ABANDONED_AFTER_HOURS],
  )

  for (const row of rows) {
    await pool.query(
      "UPDATE attachments SET status = 'rejected', deleted_at = now() WHERE id = $1",
      [row.id],
    )
    await deleteObjectBestEffort(s3, bucket, row.storage_key)
  }

  return rows.length
}
