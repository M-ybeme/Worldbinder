import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';
import { HealthController } from './health.controller';
import { PostgresHealthIndicator } from './indicators/postgres.health-indicator';
import { QueueHealthIndicator } from './indicators/queue.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

@Module({
  imports: [TerminusModule, StorageModule, JobsModule],
  controllers: [HealthController],
  providers: [
    PostgresHealthIndicator,
    RedisHealthIndicator,
    StorageHealthIndicator,
    QueueHealthIndicator,
  ],
})
export class HealthModule {}
