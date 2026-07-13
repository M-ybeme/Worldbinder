import type { ConnectionOptions } from 'bullmq';

// A plain options object, not a constructed ioredis client — BullMQ
// bundles its own ioredis version, and the app's own `ioredis` dependency
// can drift to a structurally-incompatible minor version (confirmed: two
// different ioredis versions resolved in this monorepo's node_modules),
// so handing BullMQ an already-constructed Redis instance breaks typecheck.
// maxRetriesPerRequest: null is BullMQ's own required blocking-command
// setting — distinct from the @Global() REDIS token, which is a plain
// ioredis client configured for rate limiting.
// Duplicated (not shared) with apps/worker's equivalent, same precedent as
// the S3 client factory.
export function createQueueConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
