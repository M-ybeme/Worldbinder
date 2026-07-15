import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  IMPORT_QUEUE_NAME,
  RUN_IMPORT_JOB_NAME,
  VALIDATE_IMPORT_JOB_NAME,
  type RunImportJobData,
  type ValidateImportJobData,
} from '@worldbinder/contracts';
import { Queue } from 'bullmq';
import { EnvService } from '../config/env.service';
import { createQueueConnection } from './queue-connection';

@Injectable()
export class ImportQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<ValidateImportJobData | RunImportJobData>;

  constructor(env: EnvService) {
    this.queue = new Queue(IMPORT_QUEUE_NAME, {
      connection: createQueueConnection(env.values.REDIS_URL),
    });
  }

  async enqueueValidation(importId: string): Promise<void> {
    await this.queue.add(VALIDATE_IMPORT_JOB_NAME, { importId });
  }

  async enqueueRun(importId: string): Promise<void> {
    await this.queue.add(RUN_IMPORT_JOB_NAME, { importId });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
