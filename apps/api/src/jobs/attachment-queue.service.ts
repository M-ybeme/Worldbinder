import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  ATTACHMENT_PROCESSING_QUEUE_NAME,
  PROCESS_ATTACHMENT_JOB_NAME,
  type ProcessAttachmentJobData,
} from '@worldbinder/contracts';
import { Queue } from 'bullmq';
import { EnvService } from '../config/env.service';
import { createQueueConnection } from './queue-connection';

@Injectable()
export class AttachmentQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<ProcessAttachmentJobData>;

  constructor(env: EnvService) {
    this.queue = new Queue(ATTACHMENT_PROCESSING_QUEUE_NAME, {
      connection: createQueueConnection(env.values.REDIS_URL),
    });
  }

  async enqueueProcessing(attachmentId: string): Promise<void> {
    await this.queue.add(PROCESS_ATTACHMENT_JOB_NAME, { attachmentId });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
