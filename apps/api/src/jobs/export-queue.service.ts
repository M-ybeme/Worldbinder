import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  EXPORT_CAMPAIGN_JOB_NAME,
  EXPORT_QUEUE_NAME,
  type ExportCampaignJobData,
} from '@worldbinder/contracts';
import { Queue } from 'bullmq';
import { rejectAfter } from '../common/timeout.util';
import { EnvService } from '../config/env.service';
import { createQueueConnection } from './queue-connection';

@Injectable()
export class ExportQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<ExportCampaignJobData>;

  constructor(env: EnvService) {
    this.queue = new Queue(EXPORT_QUEUE_NAME, {
      connection: createQueueConnection(env.values.REDIS_URL),
    });
  }

  async enqueueExport(exportId: string): Promise<void> {
    await this.queue.add(EXPORT_CAMPAIGN_JOB_NAME, { exportId });
  }

  /** Milestone 14 Phase 11 — for `QueueHealthIndicator`. This queue stands
   * in for "the job queue" generally: all three queue services (export/
   * import/attachment) share the same Redis instance and BullMQ version,
   * so they fail and recover together in essentially every real scenario —
   * checking one is representative without three redundant connections.
   * Timeout-wrapped because `waitUntilReady()` on an already-broken
   * connection can otherwise block on ioredis's own retry backoff instead
   * of failing promptly. */
  async isHealthy(): Promise<boolean> {
    try {
      await Promise.race([
        this.queue.waitUntilReady(),
        rejectAfter(2000, 'Queue health check timed out'),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
