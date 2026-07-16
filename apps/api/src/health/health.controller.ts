import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './indicators/postgres.health-indicator';
import { QueueHealthIndicator } from './indicators/queue.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.postgres.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.storage.isHealthy('storage'),
      () => this.queue.isHealthy('queue'),
    ]);
  }
}
