import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import * as Sentry from '@sentry/nestjs';

/**
 * Milestone 14 Phase 11 — must be the very first thing `main.ts` imports,
 * before `NestFactory` or any other module: Sentry's Node SDK relies on
 * OpenTelemetry auto-instrumentation that patches modules (http, pg, ...) on
 * first `require`, so initializing after those modules already loaded misses
 * the patch entirely. Runs `loadEnv` directly rather than via `EnvService` —
 * Nest's DI container doesn't exist yet at this point in the process.
 *
 * `SENTRY_DSN` unset (the default everywhere until a real Sentry project
 * exists) means `Sentry.init` is simply never called — fully inert, not
 * initialized-with-an-empty-DSN. `SentryModule`/`SentryGlobalFilter`
 * (wired in `app.module.ts`) stay registered either way; their capture
 * calls are safe no-ops when no client was ever initialized.
 */
const env = loadEnv(apiEnvSchema);

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
}
