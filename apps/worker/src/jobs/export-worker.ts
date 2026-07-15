import type { S3Client } from '@aws-sdk/client-s3'
import {
  EXPORT_CAMPAIGN_JOB_NAME,
  EXPORT_QUEUE_NAME,
  type ExportCampaignJobData,
} from '@worldbinder/contracts'
import { Worker, type Job } from 'bullmq'
import type { Pool } from 'pg'
import { exportCampaign } from '../exports/export-campaign'
import { createQueueConnection } from './queue-connection'

export interface ExportWorkerDeps {
  redisUrl: string
  pool: Pool
  s3: S3Client
  bucket: string
}

export function createExportWorker(deps: ExportWorkerDeps): Worker {
  const { redisUrl, pool, s3, bucket } = deps

  return new Worker(
    EXPORT_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === EXPORT_CAMPAIGN_JOB_NAME) {
        const data = job.data as ExportCampaignJobData
        await exportCampaign(data.exportId, { pool, s3, bucket })
      }
    },
    { connection: createQueueConnection(redisUrl) },
  )
}
