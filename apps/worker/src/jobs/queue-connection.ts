import type { ConnectionOptions } from 'bullmq'

// A plain options object, not a constructed ioredis client — see
// apps/api's equivalent file for why (a resolved ioredis version mismatch
// between this monorepo's direct dependency and BullMQ's bundled one).
// Duplicated (not shared) with apps/api's equivalent, same precedent as the
// S3 client factory.
export function createQueueConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl)
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  }
}
