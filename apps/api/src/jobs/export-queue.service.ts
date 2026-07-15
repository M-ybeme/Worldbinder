import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  EXPORT_CAMPAIGN_JOB_NAME,
  EXPORT_QUEUE_NAME,
  type ExportCampaignJobData,
} from '@worldbinder/contracts';
import { Queue } from 'bullmq';
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

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
