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
import { EnvService } from '../config/env.service';
import { createS3Client } from './s3-client';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

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
