import {
  ATTACHMENT_PROCESSING_QUEUE_NAME,
  CLEANUP_ABANDONED_ATTACHMENTS_JOB_NAME,
} from '@worldbinder/contracts'
import { Queue } from 'bullmq'
import { createQueueConnection } from './queue-connection'

const CLEANUP_CRON = '0 * * * *' // hourly, documented judgment call

/** Registers the repeatable cleanup job on worker startup. Idempotent — a
 * fixed jobId means re-registering on every restart doesn't create
 * duplicate schedules, matching this codebase's other idempotent-startup
 * provisioning (e.g. RelationshipTypesService.onModuleInit). Returns the
 * Queue so the caller can close it on shutdown. */
export async function scheduleCleanupSweep(redisUrl: string): Promise<Queue> {
  const queue = new Queue(ATTACHMENT_PROCESSING_QUEUE_NAME, {
    connection: createQueueConnection(redisUrl),
  })
  await queue.add(
    CLEANUP_ABANDONED_ATTACHMENTS_JOB_NAME,
    {},
    { repeat: { pattern: CLEANUP_CRON }, jobId: 'attachment-cleanup-sweep' },
  )
  return queue
}
