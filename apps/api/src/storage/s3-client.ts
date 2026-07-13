import { S3Client } from '@aws-sdk/client-s3';
import type { ApiEnv } from '@worldbinder/config';

// Duplicated (not shared) between apps/api and apps/worker — apps/worker is
// a plain TypeScript process, not a NestJS app, so it can't inject this
// module's DI-wrapped StorageService. Same precedent as apps/worker's own
// logger.ts duplicating apps/api's pino setup rather than importing it.
export function createS3Client(env: ApiEnv): S3Client {
  return new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
  });
}
