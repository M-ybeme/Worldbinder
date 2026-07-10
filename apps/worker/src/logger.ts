import pino from 'pino';
import type { WorkerEnv } from '@worldbinder/config';

export function createLogger(env: WorkerEnv) {
  return pino({
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    base: { service: 'worker', environment: env.NODE_ENV },
  });
}
