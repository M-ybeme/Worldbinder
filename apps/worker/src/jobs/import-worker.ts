import type { S3Client } from '@aws-sdk/client-s3'
import {
  IMPORT_QUEUE_NAME,
  RUN_IMPORT_JOB_NAME,
  VALIDATE_IMPORT_JOB_NAME,
  type RunImportJobData,
  type ValidateImportJobData,
} from '@worldbinder/contracts'
import { Worker, type Job } from 'bullmq'
import type { Pool } from 'pg'
import { runImport } from '../imports/run-import'
import { validateImport } from '../imports/validate-import'
import { createQueueConnection } from './queue-connection'

export interface ImportWorkerDeps {
  redisUrl: string
  pool: Pool
  s3: S3Client
  bucket: string
}

export function createImportWorker(deps: ImportWorkerDeps): Worker {
  const { redisUrl, pool, s3, bucket } = deps

  return new Worker(
    IMPORT_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === VALIDATE_IMPORT_JOB_NAME) {
        const data = job.data as ValidateImportJobData
        await validateImport(data.importId, { pool, s3, bucket })
      } else if (job.name === RUN_IMPORT_JOB_NAME) {
        const data = job.data as RunImportJobData
        await runImport(data.importId, { pool, s3, bucket })
      }
    },
    { connection: createQueueConnection(redisUrl) },
  )
}
