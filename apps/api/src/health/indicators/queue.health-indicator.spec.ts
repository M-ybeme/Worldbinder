import { HealthCheckError } from '@nestjs/terminus';
import type { ExportQueueService } from '../../jobs/export-queue.service';
import { QueueHealthIndicator } from './queue.health-indicator';

describe('QueueHealthIndicator', () => {
  it('reports up when the queue check succeeds', async () => {
    const exportQueue = {
      isHealthy: jest.fn().mockResolvedValue(true),
    } as unknown as ExportQueueService;
    const indicator = new QueueHealthIndicator(exportQueue);

    await expect(indicator.isHealthy('queue')).resolves.toEqual({
      queue: { status: 'up' },
    });
  });

  it('throws a HealthCheckError when the queue check fails', async () => {
    const exportQueue = {
      isHealthy: jest.fn().mockResolvedValue(false),
    } as unknown as ExportQueueService;
    const indicator = new QueueHealthIndicator(exportQueue);

    await expect(indicator.isHealthy('queue')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
