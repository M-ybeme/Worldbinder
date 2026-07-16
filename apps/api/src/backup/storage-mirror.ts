import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { createS3Client } from '../storage/s3-client';

/**
 * Milestone 14 Phase 12 — the other half of "zero backup infrastructure
 * today" alongside the Postgres backup/restore scripts
 * (`infrastructure/scripts/`): attachments, exported archives, and
 * imported-source archives all live in object storage, not Postgres, so a
 * database-only backup can't actually recover a campaign's uploaded
 * images. Mirrors every object in the configured bucket down to a local
 * directory — works identically against local MinIO now and Cloudflare
 * R2/AWS S3 later, since it only ever talks to `STORAGE_*` env vars via
 * the same `createS3Client` helper `StorageService` uses, never anything
 * MinIO-specific.
 *
 * A plain script, not a Jest test or NestJS command — this is an operator
 * action (`pnpm --filter @worldbinder/api backup:storage`), not something
 * that runs automatically. Recovery is the mirror image: re-upload the
 * mirrored files to a fresh bucket with the same keys (a plain S3 `PUT`
 * per file preserves the original `storageKey`, which is all
 * `attachments`/`campaign_exports`/`campaign_imports` rows reference).
 */

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function listAllKeys(
  client: S3Client,
  bucket: string,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of result.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const client = createS3Client(env);
  const bucket = env.STORAGE_BUCKET;

  const outputDir =
    process.argv[2] ??
    join('storage-mirror', new Date().toISOString().replace(/[:.]/g, '-'));

  console.log(`Mirroring bucket "${bucket}" to ${outputDir}...`);

  const keys = await listAllKeys(client, bucket);
  console.log(`Found ${keys.length} objects.`);

  let totalBytes = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const buffer = await streamToBuffer(object.Body);
    totalBytes += buffer.byteLength;

    const destination = join(outputDir, key);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);

    process.stdout.write(`\r${i + 1}/${keys.length} objects mirrored`);
  }
  process.stdout.write('\n');

  console.log(
    `Done. ${keys.length} objects, ${(totalBytes / 1_000_000).toFixed(1)}MB, written to ${outputDir}`,
  );
}

main().catch((error: unknown) => {
  console.error('Storage mirror failed:', error);
  process.exit(1);
});
