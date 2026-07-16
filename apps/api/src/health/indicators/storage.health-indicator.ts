import { Injectable } from '@nestjs/common';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class StorageHealthIndicator {
  constructor(private readonly storage: StorageService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const healthy = await this.storage.isHealthy();
    if (!healthy) {
      throw new HealthCheckError('Storage check failed', {
        [key]: { status: 'down' },
      });
    }
    return { [key]: { status: 'up' } };
  }
}
