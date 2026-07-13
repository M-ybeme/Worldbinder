import type { S3Client } from '@aws-sdk/client-s3'
import {
  ATTACHMENT_PROCESSING_QUEUE_NAME,
  CLEANUP_ABANDONED_ATTACHMENTS_JOB_NAME,
  PROCESS_ATTACHMENT_JOB_NAME,
  type ProcessAttachmentJobData,
} from '@worldbinder/contracts'
import { Worker, type Job } from 'bullmq'
import type pino from 'pino'
import type { Pool } from 'pg'
import { cleanupAbandonedAttachments } from '../attachments/cleanup-sweep'
import { processAttachment } from '../attachments/process-attachment'
import { createQueueConnection } from './queue-connection'

export interface AttachmentWorkerDeps {
  redisUrl: string
  pool: Pool
  s3: S3Client
  bucket: string
  logger: pino.Logger
}

export function createAttachmentWorker(deps: AttachmentWorkerDeps): Worker {
  const { redisUrl, pool, s3, bucket, logger } = deps

  return new Worker(
    ATTACHMENT_PROCESSING_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === PROCESS_ATTACHMENT_JOB_NAME) {
        const data = job.data as ProcessAttachmentJobData
        await processAttachment(data.attachmentId, { pool, s3, bucket })
      } else if (job.name === CLEANUP_ABANDONED_ATTACHMENTS_JOB_NAME) {
        const rejectedCount = await cleanupAbandonedAttachments({ pool, s3, bucket })
        logger.info({ rejectedCount }, 'Cleanup sweep rejected abandoned attachments')
      }
    },
    { connection: createQueueConnection(redisUrl) },
  )
}
