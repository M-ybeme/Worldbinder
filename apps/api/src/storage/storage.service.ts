import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { rejectAfter } from '../common/timeout.util';
import { EnvService } from '../config/env.service';
import { createS3Client } from './s3-client';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
// Inline images (presignInlineImage): one URL per window, so a browser
// downloads a map image at most once per window. A URL handed out stays
// valid for between one and two windows.
const INLINE_IMAGE_WINDOW_SECONDS = 30 * 60;

export interface PresignedUpload {
  uploadUrl: string;
  expiresAt: Date;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly env: EnvService) {
    this.client = createS3Client(this.env.values);
    this.bucket = this.env.values.STORAGE_BUCKET;
  }

  /** Auto-creates the local/CI bucket so `pnpm infra:up` + first boot needs
   * no manual MinIO console step. Skipped in production — real S3/R2
   * deployments provision buckets via IaC, and the app's credentials may
   * deliberately lack CreateBucket permission there. Best-effort: a failure
   * here logs a warning rather than crashing the app. */
  async onModuleInit(): Promise<void> {
    if (this.env.values.NODE_ENV === 'production') return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      } catch (error) {
        this.logger.warn(
          `Could not verify or create storage bucket "${this.bucket}": ${String(error)}`,
        );
      }
    }
  }

  /** Milestone 14 Phase 11 — for `StorageHealthIndicator`. Same
   * `HeadBucketCommand` `onModuleInit` already uses to verify the bucket
   * exists, wrapped with an explicit timeout so a genuinely unreachable
   * endpoint reports "down" promptly instead of leaving `GET /health`
   * hanging on the S3 SDK's own (much longer) retry/timeout defaults. */
  async isHealthy(): Promise<boolean> {
    try {
      await Promise.race([
        this.client.send(new HeadBucketCommand({ Bucket: this.bucket })),
        rejectAfter(2000, 'Storage health check timed out'),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async presignUpload(storageKey: string): Promise<PresignedUpload> {
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return {
      uploadUrl,
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }

  /** `originalFilename` is only ever used here, for the browser's
   * Content-Disposition — the storage key itself stays fully opaque. */
  async presignDownload(
    storageKey: string,
    originalFilename: string,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ResponseContentDisposition: `attachment; filename="${sanitizeForHeader(originalFilename)}"`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  /**
   * A signed URL for showing an image inline (map images) that stays the
   * same for a while, so the browser can reuse what it already downloaded.
   * A plain presigned URL carries the time it was signed, so every request
   * produced a new URL and a full re-download (17 MB a visit for a large
   * map). Here the signing time is rounded down to the start of a window:
   * everyone asking within the same window gets the same URL, valid for
   * one more window after it ends, and storage serves it with a matching
   * `Cache-Control` (attachments never change once uploaded).
   */
  async presignInlineImage(
    storageKey: string,
    now = new Date(),
  ): Promise<string> {
    const windowMs = INLINE_IMAGE_WINDOW_SECONDS * 1000;
    const windowStart = new Date(
      Math.floor(now.getTime() / windowMs) * windowMs,
    );
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ResponseCacheControl: `private, max-age=${INLINE_IMAGE_WINDOW_SECONDS}, immutable`,
      }),
      { expiresIn: 2 * INLINE_IMAGE_WINDOW_SECONDS, signingDate: windowStart },
    );
  }

  /** Returns the verified object size, or null if the object doesn't exist
   * (the client claimed completion without actually uploading). */
  async headObjectSize(storageKey: string): Promise<number | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return result.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete storage object "${storageKey}": ${String(error)}`,
      );
    }
  }
}

function sanitizeForHeader(filename: string): string {
  // Strips characters that would break a quoted Content-Disposition header
  // value or enable header injection — display sanitization only, the
  // stored originalFilename value itself is untouched.
  return filename.replace(/["\r\n]/g, '');
}
