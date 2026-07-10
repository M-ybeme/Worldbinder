import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected PING response: ${String(pong)}`);
      }
      return { [key]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError('Redis check failed', {
        [key]: { status: 'down', message: (error as Error).message },
      });
    }
  }
}
