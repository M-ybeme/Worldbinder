import type { EnvService } from '../config/env.service';
import { StorageService } from './storage.service';

function makeService(): StorageService {
  const env = {
    values: {
      STORAGE_ENDPOINT: 'http://127.0.0.1:9000',
      STORAGE_REGION: 'us-east-1',
      STORAGE_FORCE_PATH_STYLE: true,
      STORAGE_ACCESS_KEY_ID: 'test-key',
      STORAGE_SECRET_ACCESS_KEY: 'test-secret',
      STORAGE_BUCKET: 'test-bucket',
    },
  } as unknown as EnvService;
  return new StorageService(env);
}

describe('StorageService.presignInlineImage', () => {
  const service = makeService();
  const at = (iso: string) => new Date(iso);

  it('gives the same URL throughout a 30-minute window, so the browser can reuse the image', async () => {
    const a = await service.presignInlineImage(
      'k/map.png',
      at('2026-11-04T10:00:05Z'),
    );
    const b = await service.presignInlineImage(
      'k/map.png',
      at('2026-11-04T10:29:59Z'),
    );
    expect(a).toBe(b);
    expect(new URL(a).searchParams.get('X-Amz-Date')).toBe('20261104T100000Z');
  });

  it('gives a new URL in the next window, valid for two windows from its start', async () => {
    const a = await service.presignInlineImage(
      'k/map.png',
      at('2026-11-04T10:29:59Z'),
    );
    const b = await service.presignInlineImage(
      'k/map.png',
      at('2026-11-04T10:30:00Z'),
    );
    expect(a).not.toBe(b);
    const url = new URL(b);
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261104T103000Z');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
  });

  it('asks storage to let the browser cache it for the window', async () => {
    const url = new URL(
      await service.presignInlineImage('k/map.png', at('2026-11-04T10:00:00Z')),
    );
    expect(url.searchParams.get('response-cache-control')).toBe(
      'private, max-age=1800, immutable',
    );
  });

  it('signs per object: different images never share a URL', async () => {
    const now = at('2026-11-04T10:00:00Z');
    expect(await service.presignInlineImage('k/one.png', now)).not.toBe(
      await service.presignInlineImage('k/two.png', now),
    );
  });
});
