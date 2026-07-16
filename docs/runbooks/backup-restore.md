# Backup, restore, and migration rollback

Written as part of Milestone 14 Phase 12 (Performance, Security, and Reliability Hardening). Describes tooling that actually exists and has actually been run locally, not an aspirational target — see `WORLDBINDER_V1_ROADMAP.md`'s Phase 12 notes for what was verified and when. A live drill against a real hosted Postgres instance is deferred to Milestone 16, once Railway is actually provisioned — everything below is a **local rehearsal** against docker-compose Postgres/MinIO.

## What exists

- `infrastructure/scripts/backup.sh` — dumps the database at `$DATABASE_URL` to a local file.
- `infrastructure/scripts/restore.sh` — restores a dump file into a target database.
- `infrastructure/scripts/restore-drill.sh` — rehearses the full mechanism end to end: backs up the real database, restores that backup into an isolated scratch database, verifies row counts match, then drops the scratch database. Never touches the real database destructively.
- `pnpm --filter @worldbinder/api backup:storage [output-dir]` — mirrors every object in the configured storage bucket (attachments, export archives, import source archives) to a local directory. Database backups alone can't recover uploaded files; this is the other half.

All four are **environment-agnostic by design**: they read connection info from `DATABASE_URL`/`STORAGE_*` env vars, never a hardcoded target. The same scripts back up local docker-compose Postgres/MinIO today and a real deployed Postgres/R2 later — only the env vars change, not the scripts. The Postgres scripts run `pg_dump`/`pg_restore`/`psql` inside a throwaway `postgres:17-alpine` container (matching this repo's compose Postgres version) rather than requiring client tools installed on the host — the only real dependency is Docker, already required for local dev. `infrastructure/scripts/rewrite-url.js` rewrites a `localhost`/`127.0.0.1` host to `host.docker.internal` so that throwaway container can reach the host's published Postgres port; any other host (a real deployed `DATABASE_URL`) passes through unchanged.

## Running a backup

```bash
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)" \
  bash infrastructure/scripts/backup.sh [output-file]
```

(Using `grep`/`cut` to pull just `DATABASE_URL` out of `.env` rather than `source`-ing the whole file — `.env` has values like `MAIL_FROM=Worldbinder <noreply@worldbinder.local>` that aren't valid bash syntax to `source` directly.)

Defaults to `backup-<timestamp>.dump` in the current directory if no output path is given. Output is `pg_dump`'s custom format (`-Fc`) — compressed, and the only format `pg_restore` can do selective/parallel restores from.

## Running a restore

```bash
bash infrastructure/scripts/restore.sh <dump-file> [target-database-url]
```

Target defaults to `$DATABASE_URL` if omitted. **This is destructive** — `pg_restore --clean --if-exists` drops existing objects before recreating them, so the target ends up exactly matching the archive. Never point this at a database you don't intend to fully overwrite.

## Rehearsing the full mechanism (safe — no destructive step)

```bash
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)" \
  bash infrastructure/scripts/restore-drill.sh
```

Backs up the real database, restores into a throwaway `worldbinder_restore_drill` database, compares row counts across `users`/`campaigns`/`entities`/`entity_relationships`/`sessions`/`plot_threads`/`timeline_events`/`maps`, then drops the scratch database and deletes the dump file — the real database is never modified.

## Migration rollback procedure

`drizzle-kit` only generates forward migrations — there is no down-migration path by design (see `docs/decisions/0005-drizzle-over-prisma.md`). **Restoring a pre-migration backup is the only rollback mechanism this project has.** If a migration needs to be rolled back:

1. Before applying any migration to a real target, take a backup with `backup.sh`.
2. If the migration causes a problem, restore that backup with `restore.sh` — this reverts both the schema and the data to their pre-migration state.
3. There is no partial rollback: restoring a backup reverts everything to the moment the backup was taken, not just the one migration.

CI's `validate-migrations` job already guards against schema drift (uncommitted/inconsistent migration files) before this procedure would ever be needed — this is the recovery path for a migration that was valid but had an unexpected effect once applied to real data.

## Transaction atomicity

Restoring a *whole database* is the recovery mechanism for a *bad migration*. It's not needed for an in-flight write that fails partway through — Drizzle's `db.transaction(async (tx) => {...})` (used throughout the service layer for multi-step writes, e.g. `campaigns.service.ts`'s campaign-plus-owner-membership creation) already guarantees that a failure anywhere in the callback rolls back everything written earlier in the same callback, via Postgres's own transaction semantics. This is verified by a real forced-failure test — `apps/api/test/transaction-atomicity.e2e-spec.ts` — that triggers a genuine unique-constraint violation partway through a transaction and confirms the earlier insert in that same transaction did not persist. Not a synthetic `throw`; a real constraint violation, so it's Postgres's own rollback being exercised through Drizzle's wrapper, not a JS try/catch masking a partial write.

## Object storage recovery

`backup:storage`'s mirror is recovered by re-uploading the mirrored files to a fresh bucket with the same keys (a plain S3 `PUT` per file, preserving the original path) — every `attachments`/`campaign_exports`/`campaign_imports` row references its object purely by `storageKey`, so as long as the key is preserved on re-upload, the database rows need no changes to find their files again.

## What's been verified locally (2026-07-16)

- `restore-drill.sh` run against the real local dev database (191 users, 120 campaigns, 10,139 entities, 50,020 relationships, 259 sessions, 2,014 plot threads, 502 timeline events, 21 maps at the time) — full backup → restore-into-scratch-database → row-count verification passed on every table, scratch database and dump file cleaned up afterward.
- `backup:storage` run against the real local MinIO bucket — 676 objects (8.6MB) mirrored successfully, file count on disk confirmed to match the object count exactly.
- The transaction-atomicity forced-failure test passes as part of the normal `pnpm test:integration` run against real Postgres.

## Deferred to Milestone 16

- A live drill against a real hosted Postgres instance (Railway Postgres doesn't exist yet — the whole point of this milestone was making the app feature-complete and environment-driven *before* provisioning it).
- Automated/scheduled backups (a cron job, Railway's own backup feature, or similar) — everything above is a manually-triggered operator action today, not a running service.
- Live alert testing tied to a failed backup.
