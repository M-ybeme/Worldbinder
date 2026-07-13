import { describe, expect, it, vi } from 'vitest';
import { cleanupAbandonedAttachments } from './cleanup-sweep';

describe('cleanupAbandonedAttachments', () => {
  it('rejects and deletes each abandoned row returned by the sweep query', async () => {
    const abandoned = [
      { id: 'a1', storage_key: 'attachments/c/a1' },
      { id: 'a2', storage_key: 'attachments/c/a2' },
    ];
    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.trim().startsWith('SELECT id, storage_key')) return { rows: abandoned };
        return { rows: [] };
      }),
    };
    const s3 = { send: vi.fn(async () => ({})) };

    const count = await cleanupAbandonedAttachments({ pool: pool as never, s3: s3 as never, bucket: 'b' });

    expect(count).toBe(2);
    const updateQueries = queries.filter((q) => q.sql.includes("status = 'rejected'"));
    expect(updateQueries).toHaveLength(2);
    expect(updateQueries.map((q) => q.params[0])).toEqual(['a1', 'a2']);
    expect(s3.send).toHaveBeenCalledTimes(2);
  });

  it('returns 0 and touches no rows when nothing is abandoned', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const s3 = { send: vi.fn(async () => ({})) };

    const count = await cleanupAbandonedAttachments({ pool: pool as never, s3: s3 as never, bucket: 'b' });

    expect(count).toBe(0);
    expect(s3.send).not.toHaveBeenCalled();
  });
});
