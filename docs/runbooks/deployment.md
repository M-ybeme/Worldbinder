# Deployment runbook

**Production is live as of 2026-08-13.** `worldbinder.net` is deployed on Railway, DNS/TLS verified, real Postgres/Redis/R2/Resend/Sentry all wired in and confirmed working end to end. This runbook originally described the _intended_ process before any of it existed; it now also records what actually happened and the real gotchas hit along the way, per the checklist's own final step. See `WORLDBINDER_V1_ROADMAP.md`'s Milestone 16 section for the source-of-truth checklist this narrates.

## Target topology

- **Domain**: `worldbinder.net`, DNS on Cloudflare.
- **Hosting**: Railway — three services from one repo: `api`, `worker`, `web` (ADR-0003's modular monolith: `api`/`worker` are two processes sharing one codebase, not independently versioned; `web` is the static SPA build, served by Caddy). Railway-managed Postgres and Redis.
- **Object storage**: Cloudflare R2, S3-compatible (ADR-0012) — no code difference from local MinIO, only `STORAGE_*` env vars change.
- **Transactional email**: Resend's HTTP API, not SMTP (ADR-0022, superseding ADR-0021's original SMTP-relay plan) — Railway blocks outbound SMTP below its Pro plan, found via a real `ETIMEDOUT` in production. `RESEND_API_KEY` set in production only; local dev/CI still use SMTP against Mailpit unchanged.
- **Monitoring**: Sentry, wired in since Milestone 14 Phase 11, now live with real DSNs — verified for real via `Sentry.captureException` against the production DSN (`railway run` + a one-off script), not just assumed from config.

See `docs/architecture/environment-variables.md` for every variable and its actual production status, and `docs/architecture/overview.md` for the process topology this maps onto.

## Real gotchas found during provisioning (read before repeating this elsewhere)

- **Railway's Railpack builder didn't reliably detect this repo's pnpm workspace** and defaulted to `npm install`, which can't parse `workspace:*` dependencies. Fixed with explicit per-app Dockerfiles (`apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`) rather than fighting Railpack's auto-detection — more deterministic, and matches Railway's own guidance for tricky monorepo builds.
- **Railway custom domains need both a TXT and a CNAME record** — the CNAME alone won't verify. For Cloudflare specifically, the CNAME must be set to **DNS only** (grey cloud), not proxied, or certificate validation fails.
- **A Railway service's actual listening port can differ from what you expect even when `PORT` is set correctly** — worth confirming the real bound port from fresh deploy logs (not a stale/mid-rollout log snapshot) before configuring a custom domain's target port, rather than assuming.
- **Railway blocks outbound SMTP (ports 25/465/587/2525) below its Pro plan** — a platform firewall policy, not a per-app config issue. No SMTP port swap fixes it; the fix is either upgrading to Pro or sending mail over HTTPS instead (ADR-0022).
- **`railway logs` streams indefinitely by default** — always pass `--since`/`--lines` for a bounded, non-streaming fetch when scripting against it, or a command chained after it will appear to hang forever.
- **`railway run <cmd>` executes locally** with the target service's real env vars injected — genuinely useful for one-off verification (running a migration through an SSH tunnel via `railway connect <service> --tunnel-only`, or sending a real test exception to Sentry with the real production DSN) without touching the live deployed containers at all.

## First deployment checklist (completed 2026-08-13)

1. ✅ Purchased/controlled `worldbinder.net`, DNS on Cloudflare.
2. ✅ Created the Railway project; `api`/`worker`/`web` as three services from this repo (see the Dockerfile gotcha above for why this needed explicit Dockerfiles).
3. ✅ `DATABASE_URL`/`REDIS_URL` set via Railway's `${{Postgres.DATABASE_URL}}`/`${{Redis.REDIS_URL}}` reference-variable syntax on both `api` and `worker`.
4. ✅ R2 bucket and credentials created; `STORAGE_*` set on `api` and `worker`, `NODE_ENV=production` flipped on both at the same time (flipping it earlier, before real storage credentials existed, would have failed closed against the dev-credential-rejection guard — ADR-0016/Milestone 14 Phase 4b).
5. ✅ `worldbinder.net`, `www.worldbinder.net` → `web`; `api.worldbinder.net` → `api`. All three DNS-verified, certificates issued.
6. ✅ `CORS_ORIGIN`, `FRONTEND_URL`, `COOKIE_DOMAIN` set to the real domain on `api`; `VITE_API_URL` set on `web` (build-time — triggers a rebuild, confirmed baked into the served bundle by checking the live JS for the string, not just assumed); real `JWT_ACCESS_SECRET` generated fresh, not `.env.example`'s placeholder.
7. ✅ Resend account created, `worldbinder.net` domain verified (DKIM/SPF/MX/DMARC — Resend's own Cloudflare integration applied these directly, cleaner than manual copy-paste).
8. ✅ **Not SMTP** — `RESEND_API_KEY` set on `api` only (see ADR-0022 for why the original SMTP-relay plan didn't work in production).
9. ✅ Sent a real registration through the live API — first attempt genuinely failed (`ETIMEDOUT` reaching `smtp.resend.com:587`, this checklist's own gotcha above), fixed, then verified again for real after the ADR-0022 code change shipped.
10. Verify auth/session cookies behave correctly on the real domain — `Secure` flag, `SameSite=Lax`, `/auth` path scope, correct `Domain` (ADR-0007).
11. ✅ Sentry projects created (`worldbinder-api` shared by `api`+`worker`, `worldbinder-web`); DSNs set; verified for real via `Sentry.captureException` through `railway run` against the real production DSN, and confirmed `VITE_SENTRY_DSN` is baked into the live web bundle.
12. Run production smoke tests (a real signup → campaign creation → core-workflow pass against the live deployment).
13. Run the live backup/restore drill against the real hosted Postgres — still outstanding, the local rehearsal (`docs/runbooks/backup-restore.md`) is proven but the live drill against this real Railway Postgres hasn't happened yet.
14. This runbook updated with the real specifics above.

## Rollback

Migrations are forward-only (`drizzle-kit` doesn't generate down-migrations by design, per `docs/decisions/0005-drizzle-over-prisma.md`). "Rollback" for this project means restore-from-backup, not a reverse migration — see `docs/runbooks/backup-restore.md`. There is no blue-green or canary deployment process defined yet; a bad deploy is rolled back via Railway's own deployment history (redeploy the previous build) plus a database restore only if the bad deploy also corrupted data.

## Incident response

If something goes wrong post-deployment, `docs/runbooks/incident-triage.md` and `docs/runbooks/security-incident.md` cover diagnosis and response — both already written against this app's real `/health` endpoint, log shapes, and Redis key patterns, and will need only their "once Railway/Sentry exist" placeholder sections filled in with real specifics once this runbook's checklist is actually complete.
