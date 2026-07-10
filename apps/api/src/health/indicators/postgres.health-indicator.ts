import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';

@Injectable()
export class PostgresHealthIndicator {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.pool.query('SELECT 1');
      return { [key]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError('Postgres check failed', {
        [key]: { status: 'down', message: (error as Error).message },
      });
    }
  }
}
