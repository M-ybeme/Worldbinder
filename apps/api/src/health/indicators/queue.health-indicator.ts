import { Injectable } from '@nestjs/common';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { ExportQueueService } from '../../jobs/export-queue.service';

@Injectable()
export class QueueHealthIndicator {
  constructor(private readonly exportQueue: ExportQueueService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const healthy = await this.exportQueue.isHealthy();
    if (!healthy) {
      throw new HealthCheckError('Queue check failed', {
        [key]: { status: 'down' },
      });
    }
    return { [key]: { status: 'up' } };
  }
}
