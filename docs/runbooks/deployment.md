# Deployment runbook

**Forward-looking — describes the intended production deployment process, not something that has happened yet.** As of this writing (Milestone 16, 2026-08-12), no production infrastructure is provisioned: no Railway project, no `worldbinder.net` DNS, no Resend account, no Sentry project. This runbook exists so the actual provisioning work (Milestone 16's own job) has a checklist to follow and later verify against, and so this document can be updated with real specifics — commands, dashboard screenshots, gotchas — once that provisioning actually happens. See `WORLDBINDER_V1_ROADMAP.md`'s Milestone 16 section for the authoritative, up-to-date checklist; this runbook narrates the same steps with more process detail.

## Target topology

- **Domain**: `worldbinder.net`, DNS controlled by the project (registrar itself isn't architecturally important).
- **Hosting**: Railway — `apps/api` and `apps/worker` as separate services (ADR-0003's modular monolith: two processes, one codebase, not independently versioned), Railway-managed Postgres and Redis.
- **Object storage**: Cloudflare R2, S3-compatible (ADR-0012) — no code difference from local MinIO, only `STORAGE_*` env vars change.
- **Transactional email**: Resend's SMTP relay, through the existing `nodemailer` transport (ADR-0021) — no code difference from local Mailpit, only `SMTP_*` env vars change.
- **Monitoring**: Sentry, already wired in and env-gated (Milestone 14 Phase 11) — inert until `SENTRY_DSN`/`VITE_SENTRY_DSN` are set.

See `docs/architecture/environment-variables.md` for every variable that needs a real production value, and `docs/architecture/overview.md` for the process topology this maps onto.

## First deployment checklist

Mirrors `WORLDBINDER_V1_ROADMAP.md`'s Milestone 16 provisioning checklist:

1. Purchase/control `worldbinder.net` and its DNS.
2. Create the Railway project; provision the API and worker as separate services from this repo, plus Railway-managed Postgres and Redis.
3. Set `DATABASE_URL`/`REDIS_URL` from Railway's provisioned values (both processes share them, per `docs/architecture/data-model.md`'s tenancy model).
4. Create the R2 bucket and credentials; set `STORAGE_ENDPOINT`/`STORAGE_REGION=auto`/`STORAGE_BUCKET`/`STORAGE_ACCESS_KEY_ID`/`STORAGE_SECRET_ACCESS_KEY`/`STORAGE_FORCE_PATH_STYLE=false`.
5. Point `worldbinder.net` (and `www`, plus any `api.` subdomain only if Railway's actual topology benefits from one — don't create one speculatively) at the deployed app via Railway's custom-domain DNS instructions.
6. Set `CORS_ORIGIN=https://worldbinder.net`, `FRONTEND_URL=https://worldbinder.net`, `COOKIE_DOMAIN=worldbinder.net`, and a real `JWT_ACCESS_SECRET` (generate one — do not deploy with `.env.example`'s placeholder, which is long enough to pass the 32-character validation unchanged and would boot successfully with a well-known signing key).
7. Create the Resend account; verify sending-domain authentication for `worldbinder.net` per Resend's DNS instructions (SPF/DKIM records).
8. Set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, real `SMTP_USER`/`SMTP_PASSWORD` from Resend, and `MAIL_FROM` to a real `worldbinder.net` address (e.g. `Worldbinder <notifications@worldbinder.net>`).
9. Send a real registration-verification email, a real password-reset email, and a real campaign-invitation email end to end against the hosted environment; confirm every link in them resolves to the correct `worldbinder.net` route (not `localhost`).
10. Verify auth/session cookies behave correctly on the real domain — `Secure` flag, `SameSite=Lax`, `/auth` path scope, correct `Domain` (ADR-0007).
11. Create the Sentry project; set `SENTRY_DSN` (API/worker) and `VITE_SENTRY_DSN` (web); trigger a real error in each process and confirm it reaches Sentry.
12. Run production smoke tests (a real signup → campaign creation → core-workflow pass against the live deployment).
13. Run the live backup/restore drill against the real hosted Postgres — the local rehearsal (`docs/runbooks/backup-restore.md`) already proved the scripts work; this is the first time they run against a real target, deliberately deferred from Milestone 14 to here.
14. Update this runbook with whatever real specifics were discovered — exact Railway service names, actual DNS record values, any gotcha hit along the way. Placeholder/invented values are deliberately absent from this document until they're real.

## Rollback

Migrations are forward-only (`drizzle-kit` doesn't generate down-migrations by design, per `docs/decisions/0005-drizzle-over-prisma.md`). "Rollback" for this project means restore-from-backup, not a reverse migration — see `docs/runbooks/backup-restore.md`. There is no blue-green or canary deployment process defined yet; a bad deploy is rolled back via Railway's own deployment history (redeploy the previous build) plus a database restore only if the bad deploy also corrupted data.

## Incident response

If something goes wrong post-deployment, `docs/runbooks/incident-triage.md` and `docs/runbooks/security-incident.md` cover diagnosis and response — both already written against this app's real `/health` endpoint, log shapes, and Redis key patterns, and will need only their "once Railway/Sentry exist" placeholder sections filled in with real specifics once this runbook's checklist is actually complete.
