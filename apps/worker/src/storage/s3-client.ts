import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { WorkerEnv } from '@worldbinder/config'

// Duplicated (not shared) between apps/worker and apps/api — apps/worker is
// a plain TypeScript process, not a NestJS app, so it can't inject
// apps/api's DI-wrapped StorageService. Same precedent as this file's own
// logger.ts duplicating apps/api's pino setup rather than importing it.
export function createS3Client(env: WorkerEnv): S3Client {
  return new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
  })
}

export async function deleteObjectBestEffort(
  s3: S3Client,
  bucket: string,
  storageKey: string,
): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
  } catch (error) {
    console.warn(`Failed to delete storage object "${storageKey}":`, error)
  }
}
