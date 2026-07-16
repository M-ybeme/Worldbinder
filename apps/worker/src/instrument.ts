import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import * as Sentry from '@sentry/node'

/**
 * Milestone 14 Phase 11 — must be the very first thing `main.ts` imports,
 * before any other module: Sentry's Node SDK relies on OpenTelemetry
 * auto-instrumentation that patches modules (http, pg, ...) on first
 * `require`, so initializing after those modules already loaded misses the
 * patch entirely.
 *
 * `SENTRY_DSN` unset (the default everywhere until a real Sentry project
 * exists) means `Sentry.init` is simply never called — fully inert, not
 * initialized-with-an-empty-DSN. The `Sentry.captureException` calls in
 * main.ts's worker `.on('failed', ...)` handlers are safe no-ops either way.
 */
const env = loadEnv(workerEnvSchema)

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  })
}
