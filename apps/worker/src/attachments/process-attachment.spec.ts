import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { processAttachment } from './process-attachment';

function fakePool(storageKey = 'attachments/campaign/attachment') {
  const queries: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT storage_key')) {
      return { rows: [{ storage_key: storageKey }] };
    }
    return { rows: [] };
  });
  return { query, queries };
}

function fakeS3(bodyBytes: Uint8Array | null) {
  return {
    send: vi.fn(async () => {
      if (!bodyBytes) throw new Error('object not found');
      return {
        Body: (async function* () {
          yield bodyBytes;
        })(),
      };
    }),
  };
}

// Minimal valid 1x1 PNG (matches the fixture used in browser verification).
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('processAttachment', () => {
  it('marks a valid PNG ready with detected type, hash, and dimensions', async () => {
    const pool = fakePool();
    const s3 = fakeS3(VALID_PNG);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    const updateCall = pool.queries.find((q) => q.sql.includes("status = 'ready'"));
    expect(updateCall).toBeDefined();
    const [, detectedMimeType, sha256, width, height, sizeBytes] = updateCall!.params;
    expect(detectedMimeType).toBe('image/png');
    expect(sha256).toBe(createHash('sha256').update(VALID_PNG).digest('hex'));
    expect(width).toBe(1);
    expect(height).toBe(1);
    expect(sizeBytes).toBe(VALID_PNG.byteLength);
  });

  it('marks plain text ready via the text heuristic (no magic number)', async () => {
    const textBytes = Buffer.from('Just some plain campaign notes.\nSecond line.', 'utf8');
    const pool = fakePool();
    const s3 = fakeS3(textBytes);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    const updateCall = pool.queries.find((q) => q.sql.includes("status = 'ready'"));
    expect(updateCall).toBeDefined();
    expect(updateCall!.params[1]).toBe('text/plain');
  });

  it('rejects a file whose bytes match neither a magic number nor the text heuristic', async () => {
    const executableBytes = Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]);
    const pool = fakePool();
    const s3 = fakeS3(executableBytes);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    const rejectCall = pool.queries.find((q) => q.sql.includes("status = 'rejected'"));
    expect(rejectCall).toBeDefined();
    const readyCall = pool.queries.find((q) => q.sql.includes("status = 'ready'"));
    expect(readyCall).toBeUndefined();
  });

  it('rejects an object whose magic bytes claim an image type it cannot actually parse', async () => {
    // Real PNG signature, but truncated before any IHDR chunk exists.
    const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pool = fakePool();
    const s3 = fakeS3(truncated);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    const rejectCall = pool.queries.find((q) => q.sql.includes("status = 'rejected'"));
    expect(rejectCall).toBeDefined();
  });

  it('rejects when the object is missing from storage entirely', async () => {
    const pool = fakePool();
    const s3 = fakeS3(null);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    const rejectCall = pool.queries.find((q) => q.sql.includes("status = 'rejected'"));
    expect(rejectCall).toBeDefined();
  });

  it('does nothing if the attachment row no longer exists (deleted before processing)', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const s3 = fakeS3(VALID_PNG);

    await processAttachment('attachment-id', { pool: pool as never, s3: s3 as never, bucket: 'b' });

    expect(s3.send).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledTimes(1); // only the initial SELECT
  });
});
