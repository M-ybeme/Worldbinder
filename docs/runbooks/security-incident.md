# Security incident triage

Written as part of Milestone 14 Phase 13. Complements `docs/security/threat-model.md` (the system's trust boundaries and known gaps) with what to actually check when something looks like a real security incident rather than routine noise. Local docker-compose infra only — see `docs/runbooks/incident-triage.md`'s "Once Railway/Sentry exist" note, which applies here too.

## Two audit trails — know which one to check

This app writes two separate, purpose-built audit tables. Don't confuse them:

- **`security_events`** (`apps/api/src/database/schema.ts`) — account/auth-level events, not campaign-scoped. `type` is one of: `user_registered`, `email_verified`, `login_succeeded`, `login_failed`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `session_revoked`, `refresh_reuse_detected`, `account_deactivated`. Has `userId`, `ipHash` (never a raw IP — see threat model), `metadataJson`, `createdAt`.
- **`campaign_audit_events`** — campaign-scoped actions a GM/owner would want visibility into. `type` is one of: `member_role_changed`, `member_removed`, `content_revealed`, `revision_restored`, `campaign_archived`, `campaign_deleted`, `destructive_action`, `campaign_exported`, `campaign_imported`. Has `campaignId`, `actorUserId`, a polymorphic `targetResourceType`/`targetResourceId` pair, `metadataJson` — deliberately never content bodies (roadmap §11.14). Exposed to GMs/owners via `CampaignAuditViewModule`, not just a backend-only table.

## Refresh token reuse (`refresh_reuse_detected`)

The one security event this app actively defends against, not just logs. ADR-0007's rotation-on-use model means presenting an already-rotated refresh token revokes the entire `token_family_id`, not just that one token — the standard defense against a stolen-and-replayed refresh token.

1. Query recent occurrences:
   ```sql
   SELECT user_id, ip_hash, metadata_json, created_at
   FROM security_events
   WHERE type = 'refresh_reuse_detected'
   ORDER BY created_at DESC LIMIT 20;
   ```
2. Cross-reference the `userId` against `user_sessions` for that `tokenFamilyId` (in `metadataJson`) — confirm it was actually revoked (`revokedAt` set), not just logged. `auth.service.ts`'s handler both writes the `security_events` row and revokes the family in the same code path, but confirm rather than assume during a real investigation.
3. A single isolated occurrence for one user is usually a legitimate race (e.g. a client retried a refresh call, or a stale mobile/browser tab woke up and replayed an old token) — the user was logged out and has to log back in, which is the intended, safe outcome either way.
4. **Multiple users, or repeated occurrences for one user in a short window**, is the pattern worth escalating — it suggests either a compromised refresh token actively being replayed by an attacker, or (locally) a client-side bug causing the app itself to replay tokens. Check `apps/web`'s own logs/Sentry (once configured) for the latter before assuming the former.

## Repeated login failures (`login_failed`)

```sql
SELECT ip_hash, count(*), max(created_at)
FROM security_events
WHERE type = 'login_failed' AND created_at > now() - interval '1 hour'
GROUP BY ip_hash
ORDER BY count(*) DESC
LIMIT 20;
```

Login already has a per-IP rate limit tighter than the global floor (`apps/api/src/auth/auth.constants.ts`) — a high count from one `ipHash` that isn't already being throttled down to near-zero suggests the rate limiter itself needs checking (is Redis actually reachable? see `docs/runbooks/incident-triage.md`'s Redis section) before assuming the limiter is simply set too loose.

## Suspected unauthorized data access

- Authorization is two-layered (ADR-0008/ADR-0009): route-level `CampaignRolesGuard`/`@RequireCampaignRole` plus `CampaignPolicyService` checks for anything role alone can't decide. A mismatched campaign/resource id pair returns 404, not 403 — "doesn't exist" and "exists but you can't see it" are deliberately indistinguishable to the caller, so a spike in 404s on campaign-scoped routes from one user is itself a signal worth checking against `campaign_audit_events`/`security_events`, not dismissed as harmless client bugs.
- `destructive_action` and `content_revealed` in `campaign_audit_events` are the two event types specifically meant to catch a legitimate member (who passed authorization) doing something a GM would still want to know about — check these first for an "insider" scenario rather than assuming a bypass occurred.

## Suspected malicious upload

- Attachments go through real content-type sniffing on the worker side (`apps/worker/src/attachments/magic-bytes.spec.ts` covers this), not just trusting the client's declared MIME type — a rejected attachment (`status = 'rejected'`) already means that defense worked, not that it failed.
- Archive imports (`validate-import.ts`, calling into `apps/worker/src/imports/archive.ts`'s `openArchive`) enforce a `MAX_IMPORT_ENTRY_COUNT` cap plus per-entry size caps specifically to reject zip-bomb-shaped archives before extraction — see `archive.ts` for the exact numbers.

## If credentials or secrets may have leaked

1. Rotate `JWT_ACCESS_SECRET` immediately — this invalidates every currently-issued access token (they're short-lived, 15 minutes by default, so this is a relatively low-blast-radius rotation) and forces a refresh-token round trip for every active session.
2. Rotate `STORAGE_ACCESS_KEY_ID`/`STORAGE_SECRET_ACCESS_KEY` and `SMTP_USER`/`SMTP_PASSWORD` if those specifically are what leaked — `apiEnvSchema`'s `superRefine` (Milestone 14 Phase 4b, extended to `workerEnvSchema` in Phase 9) already refuses to boot outside `development`/`test` with the known local-dev-only values, so a real deploy can't silently keep running on a leaked well-known secret once this check applies — but it only catches the _known_ dev placeholder, not an arbitrary leaked real value, so rotation is still a manual step.
3. To revoke every active session for one specific user in one call, use `changePassword` (`auth.service.ts:506`) — it revokes _all_ of that user's active `user_sessions` rows (optionally keeping one, via `keepSessionId`) as a side effect of the password change, not just the session tied to the request. `logout` and `DELETE /auth/sessions/:sessionId` only revoke one session each — don't reach for those expecting a mass revocation.
4. There is no cross-user "revoke everyone" admin action — a mass-revocation incident affecting multiple accounts today means iterating affected users individually (each via their own `changePassword` or direct `user_sessions` updates), not a single command. Worth flagging as a real gap if this scenario is ever hit for real, not something to assume exists.
