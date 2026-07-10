import { HealthCheckError } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { RedisHealthIndicator } from './redis.health-indicator';

describe('RedisHealthIndicator', () => {
  it('reports up when PING returns PONG', async () => {
    const redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redis);

    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('throws a HealthCheckError when PING fails', async () => {
    const redis = {
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redis);

    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });

  it('throws a HealthCheckError when PING returns an unexpected reply', async () => {
    const redis = {
      ping: jest.fn().mockResolvedValue('WAT'),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redis);

    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
