# Incident triage

Written as part of Milestone 14 Phase 13 (Performance, Security, and Reliability Hardening). Describes what to actually check today — local docker-compose infra, no staging/production environment exists yet (see `docs/security/threat-model.md`). Sections marked **Once Railway/Sentry exist** are placeholders for Milestone 16, when those are actually provisioned; don't follow them yet, they describe intent, not current reality.

## First response, every time

1. **Check `GET /health`.** Returns `200` with `{"status":"ok", "info": {"database":..., "redis":..., "storage":..., "queue":...}}` when everything's up, `503` with the failing checks under `"error"` otherwise (Milestone 14 Phase 11). This tells you _which_ dependency is the problem before you go looking anywhere else.
   ```bash
   curl -s http://localhost:3000/health | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')),null,2))"
   ```
   Each check times out at 2 seconds (`apps/api/src/common/timeout.util.ts`'s `rejectAfter`) — a hang here means something is unreachable, not just slow.
2. **Check the logs.** Both processes log structured JSON via `pino` (`nestjs-pino` for `apps/api`, plain `pino()` for `apps/worker`) — `pino-pretty` in development, raw JSON otherwise. Look for `level >= 50` (error) or `level === 40` (warn). `apps/api`'s HTTP request logs carry `req`/`res`/`responseTime`; ad-hoc warnings (e.g. `auth.service.ts`'s refresh-reuse detection) carry whatever fields are relevant to that event as structured properties, not just a message string — grep those field names, not just the message text.
3. **Check the docker containers are actually up**: `docker ps --format "{{.Names}}: {{.Status}}"` should show `worldbinder-postgres-1`, `worldbinder-redis-1`, `worldbinder-minio-1`, `worldbinder-mailpit-1` all `Up`/`healthy`. A container that's `Restarting` or missing explains a lot before you look at application code at all.

## Database (`/health`'s `database` check)

- `PostgresHealthIndicator` runs `SELECT 1` against the shared `pg.Pool` (`PG_POOL` token, `database/database.module.ts`). If this is down, check `docker ps` for `worldbinder-postgres-1`'s status first, then `docker logs worldbinder-postgres-1` for a crash reason.
- Connection pool exhaustion looks different from the database being down: `/health` would still report `up` (a single `SELECT 1` can usually get a connection even under load) while real requests time out. Check `apps/api` logs for slow-query patterns and consider whether a recent deploy introduced an N+1 (Milestone 14 Phase 6 fixed one real instance in `CampaignsService.list()` — that class of bug is the first thing to suspect).
- Migration-related breakage (a bad migration applied, or schema drift): see `docs/runbooks/backup-restore.md` — restoring the pre-migration backup is the only rollback path, there's no down-migration support.

## Redis (`/health`'s `redis` check)

- `RedisHealthIndicator` calls `redis.ping()` on the shared `@Global() REDIS` client (rate limiting, health checks — distinct from BullMQ's own bundled connections, see `apps/api/src/jobs/queue-connection.ts`'s comment on why they're not shared).
- Redis being down takes out rate limiting _and_ the job queue simultaneously (BullMQ needs Redis too) — expect `queue` to also report down if `redis` does.
- **Rate limiting false positives**: `GlobalRateLimitGuard` caps every route with no specific limit at 300 requests/60s per client IP (Milestone 14 Phase 5), keyed `ratelimit:global:<ip>` in Redis (`RateLimiterService`, `apps/api/src/common/rate-limiter.service.ts`). A legitimate client hitting 429s repeatedly from behind a shared IP (NAT, corporate proxy) is the most likely cause, not an attack. Auth endpoints have their own tighter per-endpoint limits (also `ratelimit:*`-prefixed) tuned for credential-guessing resistance — check `apps/api/src/auth/auth.constants.ts` for the exact numbers before assuming a limit is misconfigured.
  ```bash
  docker exec worldbinder-redis-1 redis-cli KEYS 'ratelimit:*'
  ```
  (`KEYS` is fine against local Redis; use `SCAN` instead against a real production instance with many keys.)

## Object storage (`/health`'s `storage` check)

- `StorageHealthIndicator` runs a `HeadBucketCommand` against the configured `STORAGE_BUCKET` (Milestone 14 Phase 11, `StorageService.isHealthy()`). Down means either the endpoint is unreachable or the bucket doesn't exist/credentials are wrong.
- Locally: `docker ps` for `worldbinder-minio-1`, then check its console at `http://localhost:9001` (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` from `.env`) to confirm the `worldbinder-dev` bucket exists.
- Symptom without `/health` catching it yet: presigned upload/download URLs failing client-side (wrong `STORAGE_ENDPOINT` for the browser to reach, e.g. `127.0.0.1` vs `localhost` mismatches, or a `STORAGE_FORCE_PATH_STYLE` mismatch against the actual backend — MinIO needs path-style, real S3/R2 usually don't, see `.env.example`'s comment).
- Recovery of the objects themselves (not the connection) is `docs/runbooks/backup-restore.md`'s object-storage section — re-upload a `backup:storage` mirror under the original keys.

## Background jobs (`/health`'s `queue` check, exports/imports/attachments stuck)

- `QueueHealthIndicator` checks one representative queue (`ExportQueueService.isHealthy()`, via BullMQ's `Queue.waitUntilReady()`) — all three queues (`campaign-export`, `campaign-import`, `attachment-processing`; see `packages/contracts/src/jobs.ts`) share the same Redis instance and fail together in practice.
- If `/health` says `queue: up` but jobs aren't progressing, the problem is `apps/worker` itself, not the queue connection: check `apps/worker`'s own process is running (`pnpm dev` starts it alongside `apps/api`/`apps/web`; in a real deployment it's a separate process per ADR-0003) and its logs for job-failure entries — Milestone 14 Phase 11 added `reportJobFailures()` in `apps/worker/src/main.ts`, so every job failure is logged with `jobId`/`jobName` and (once a `SENTRY_DSN` is configured) reported to Sentry.
- Check a specific job's status directly against the database rather than guessing from symptoms:
  ```sql
  -- exports: pending -> processing -> ready (or failed)
  SELECT id, status, error_message, created_at FROM campaign_exports ORDER BY created_at DESC LIMIT 10;
  -- imports: pending -> validating -> dry_run_ready -> importing -> completed (or failed)
  SELECT id, status, error_message, created_at FROM campaign_imports ORDER BY created_at DESC LIMIT 10;
  -- attachments: pending -> uploaded -> processing -> ready (or rejected/deleted)
  SELECT id, status, created_at FROM attachments ORDER BY created_at DESC LIMIT 10;
  ```
  A row stuck in a non-terminal status (`processing`/`validating`/`importing`) for longer than the job should reasonably take means the worker crashed mid-job or the job is retrying indefinitely — check `apps/worker` logs for that specific `jobId`.
- Raw BullMQ inspection (job counts, not just DB status) if needed:
  ```bash
  docker exec worldbinder-redis-1 redis-cli KEYS 'bull:campaign-export:*'
  ```

## Email delivery

- Locally, everything goes through Mailpit — check `http://localhost:8025` directly, or its REST API (`GET http://127.0.0.1:8025/api/v1/messages`, the same endpoint `apps/api/test/helpers/test-users.ts`'s `findEmailToken` polls in the integration suite).
- If `MailService.send()` (`apps/api/src/mail/mail.service.ts`) is throwing, it logs via `this.logger.error({ err, to, subject }, 'Failed to send email')` before rethrowing — check for that log line and read the underlying SMTP error, not just "email didn't arrive."
- A misconfigured `SMTP_HOST=localhost` (instead of `127.0.0.1`) is a documented, previously-hit footgun (`CLAUDE.md`): on at least one dev machine `localhost` resolves to `::1` first, where an unrelated process was squatting on port 1025 instead of Docker's Mailpit.
- Once a real provider (Resend/Postmark) is configured, see `.env.example`'s comment on their shared port-587-plus-STARTTLS shape (Milestone 14 Phase 10) — `SMTP_SECURE` should stay `false` for either.

## Elevated error rates / suspected regression

- Milestone 14 Phase 8 built two load-test harnesses (`pnpm --filter @worldbinder/api load-test:http`, `pnpm --filter @worldbinder/worker load-test:export-import`) against a 10k-entity seeded campaign (`pnpm db:seed:perf`) — rerun them to check whether a suspected performance regression is real and reproducible before assuming it's incident-worthy.
- `apps/api/src/search/search-benchmark.ts` (`pnpm --filter @worldbinder/api search:benchmark`) does the same for search specifically.

## Once Railway/Sentry exist (Milestone 16 — not yet)

- `SENTRY_DSN`/`VITE_SENTRY_DSN` set means every unexpected `apps/api` exception (via `SentryGlobalFilter`), every `apps/worker` job failure, and every uncaught `apps/web` render error is already being reported — check the Sentry project's issue stream first, before grepping raw logs, for a global view of error rate and affected users.
- Railway's own deploy logs and metrics dashboard become the first stop for "is the service even running" questions that `docker ps` answers locally today.
- This section will get filled in with real dashboard links/procedures once that infrastructure is actually provisioned — don't invent Railway-specific steps before then.
