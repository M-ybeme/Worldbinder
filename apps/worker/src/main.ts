import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import Redis from 'ioredis'
import { Pool } from 'pg'
import type { Queue, Worker } from 'bullmq'
import { createAttachmentWorker } from './jobs/attachment-worker.js'
import { scheduleCleanupSweep } from './jobs/cleanup-scheduler.js'
import { createLogger } from './logger.js'
import { createS3Client } from './storage/s3-client.js'

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

  logger.info('Worker connected to Postgres and Redis. Processing attachment jobs.')

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Worker shutting down')
    await attachmentWorker.close()
    await cleanupQueue.close()
    redis.disconnect()
    await pool.end()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  console.error('Worker failed to start:', error)
  process.exit(1)
})
