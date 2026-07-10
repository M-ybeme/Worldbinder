import { HealthCheckError } from '@nestjs/terminus';
import type { Pool } from 'pg';
import { PostgresHealthIndicator } from './postgres.health-indicator';

describe('PostgresHealthIndicator', () => {
  it('reports up when the query succeeds', async () => {
    const pool = { query: jest.fn().mockResolvedValue({}) } as unknown as Pool;
    const indicator = new PostgresHealthIndicator(pool);

    await expect(indicator.isHealthy('database')).resolves.toEqual({
      database: { status: 'up' },
    });
  });

  it('throws a HealthCheckError when the query fails', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Pool;
    const indicator = new PostgresHealthIndicator(pool);

    await expect(indicator.isHealthy('database')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
