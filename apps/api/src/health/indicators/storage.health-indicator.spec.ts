import { HealthCheckError } from '@nestjs/terminus';
import type { StorageService } from '../../storage/storage.service';
import { StorageHealthIndicator } from './storage.health-indicator';

describe('StorageHealthIndicator', () => {
  it('reports up when the storage check succeeds', async () => {
    const storage = {
      isHealthy: jest.fn().mockResolvedValue(true),
    } as unknown as StorageService;
    const indicator = new StorageHealthIndicator(storage);

    await expect(indicator.isHealthy('storage')).resolves.toEqual({
      storage: { status: 'up' },
    });
  });

  it('throws a HealthCheckError when the storage check fails', async () => {
    const storage = {
      isHealthy: jest.fn().mockResolvedValue(false),
    } as unknown as StorageService;
    const indicator = new StorageHealthIndicator(storage);

    await expect(indicator.isHealthy('storage')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
