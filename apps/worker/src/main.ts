// Must be the first import in the entire process — see instrument.ts's own
// doc comment for why (OpenTelemetry module patching has to happen before
// anything else is required).
import './instrument.js'
import * as Sentry from '@sentry/node'
import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import Redis from 'ioredis'
import { Pool } from 'pg'
import type { Job, Queue, Worker } from 'bullmq'
import { createAttachmentWorker } from './jobs/attachment-worker.js'
import { scheduleCleanupSweep } from './jobs/cleanup-scheduler.js'
import { createExportWorker } from './jobs/export-worker.js'
import { createImportWorker } from './jobs/import-worker.js'
import { createLogger } from './logger.js'
import { createS3Client } from './storage/s3-client.js'

type WorkerLogger = ReturnType<typeof createLogger>

// Job failures had no centralized capture point before this — each Worker
// only logged ad hoc, if at all, and BullMQ's own retry/failure bookkeeping
// happened silently otherwise. Sentry.captureException is a safe no-op when
// SENTRY_DSN was never set (see instrument.ts).
function reportJobFailures(worker: Worker, logger: WorkerLogger): void {
  worker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error(
      { err: error, jobId: job?.id, jobName: job?.name },
      'Job failed',
    )
    Sentry.captureException(error, {
      tags: { queue: worker.name, jobName: job?.name },
    })
  })
}

async function main(): Promise<void> {
  const env = loadEnv(workerEnvSchema)
  const logger = createLogger(env)

  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const redis = new Redis(env.REDIS_URL)
  const s3 = createS3Client(env)

  await pool.query('SELECT 1')
  await redis.ping()

  const attachmentWorker: Worker = createAttachmentWorker({
    redisUrl: env.REDIS_URL,
    pool,
    s3,
    bucket: env.STORAGE_BUCKET,
    logger,
  })
  const cleanupQueue: Queue = await scheduleCleanupSweep(env.REDIS_URL)
  const exportWorker: Worker = createExportWorker({
    redisUrl: env.REDIS_URL,
    pool,
    s3,
    bucket: env.STORAGE_BUCKET,
  })
  const importWorker: Worker = createImportWorker({
    redisUrl: env.REDIS_URL,
    pool,
    s3,
    bucket: env.STORAGE_BUCKET,
  })

  reportJobFailures(attachmentWorker, logger)
  reportJobFailures(exportWorker, logger)
  reportJobFailures(importWorker, logger)

  logger.info(
    'Worker connected to Postgres and Redis. Processing attachment, export, and import jobs.',
  )

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Worker shutting down')
    await attachmentWorker.close()
    await cleanupQueue.close()
    await exportWorker.close()
    await importWorker.close()
    redis.disconnect()
    await pool.end()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  console.error('Worker failed to start:', error)
  Sentry.captureException(error)
  process.exit(1)
})
