import { loadEnv, workerEnvSchema } from '@worldbinder/config';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { createLogger } from './logger.js';

async function main(): Promise<void> {
  const env = loadEnv(workerEnvSchema);
  const logger = createLogger(env);

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const redis = new Redis(env.REDIS_URL);

  await pool.query('SELECT 1');
  await redis.ping();

  logger.info('Worker connected to Postgres and Redis. Ready for background jobs.');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Worker shutting down');
    redis.disconnect();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
