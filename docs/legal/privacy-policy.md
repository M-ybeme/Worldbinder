# Privacy Policy

> **Draft — for owner and eventual legal review.** This document has not been reviewed by an attorney. It describes Worldbinder's actual data handling as of the Milestone 15 beta (2026-07-16), grounded in `docs/security/threat-model.md` and the current codebase — it does not describe aspirational or planned behavior except where explicitly marked "when we deploy to production." Do not treat this as a finalized legal document; do not publish it as a live policy page until it has been reviewed by counsel and the placeholders below are filled in.

**Placeholders to resolve before this becomes a live document:** legal entity name/owner name, jurisdiction, and a permanent contact email. During the Milestone 15 beta there is no hosted deployment and no public contact channel — participants deal with the developer directly, in person, per the beta's own moderated design (see `docs/product/beta-release-notes.md`).

## 1. What this covers

This policy describes what Worldbinder collects, why, and what participants can do about it. It applies to the Worldbinder application (`apps/web`, `apps/api`, `apps/worker`) as it exists today — currently run locally / in a controlled beta-testing environment, not a public hosted service. Sections describing where things will eventually run (Railway, Cloudflare R2, a transactional email provider, Sentry) are forward-looking and explicitly marked as not yet live.

## 2. What we collect

**Account data.** Email address, display name, and a hashed password (argon2 — the plaintext password is never stored). Email-verification and password-reset tokens are stored as SHA-256 hashes, never in plaintext.

**Session data.** A short-lived signed access token is issued to your browser and kept in memory only (never `localStorage`). A longer-lived refresh token is stored in an `HttpOnly`, `SameSite=Lax` cookie scoped to the `/auth` path, backed by a session record that includes a token family id (used to detect and revoke stolen/replayed refresh tokens), an approximate creation time, and standard request metadata (IP address, user agent) for that session.

**Campaign content.** Everything you deliberately create — campaigns, entities, relationships, sessions, plot threads, timeline events, maps, and file attachments (portraits, handouts, map images, etc.). Some content is marked `gm_only` by the campaign's own game master; that content is enforced as hidden at the backend authorization layer, not just hidden in the interface — it is never included in another member's search results, backlinks, or API responses unless that member's role and campaign permissions grant them access.

**Security telemetry.** A small set of security-relevant events (failed logins, refresh-token reuse detection, and similar) are logged with a hashed IP address, not the raw address, for abuse detection and incident response. See `docs/runbooks/security-incident.md` for how these are used.

**What we do not collect.** Worldbinder has no analytics or telemetry SDK, no advertising integration, and does not sell, rent, or share your data with third parties for marketing purposes. There is no payment system, so no billing or payment card data is collected. These are simply true of the current codebase — not a promise about a hypothetical future version, which would require an update to this policy first.

## 3. Where data is stored and processed

Today (during the Milestone 15 beta), all data is stored in a Postgres database and object storage (MinIO) run locally or in a controlled testing environment the developer directly controls — there is no public-facing production deployment yet. When we deploy to production (planned for Milestone 16), the same categories of data described above will move to: Railway (application hosting and managed Postgres/Redis), Cloudflare R2 (file attachments and export archives, replacing local MinIO), a transactional email provider such as Resend or Postmark (replacing local dev SMTP, used only to send verification/reset/invitation emails — not marketing email), and Sentry (error monitoring, capturing request/error metadata to help diagnose bugs, not additional personal data beyond what's already described here). This policy will be updated with specifics once that infrastructure is actually provisioned.

## 4. Who can see your content

Visibility inside a campaign follows the campaign's own membership roles (owner, GM, editor, player, viewer) and each entity's `public`/`gm_only` marking, enforced by the backend on every request — not merely hidden in the frontend. Outside of a campaign's own members, no one at Worldbinder routinely reads your campaign content; a developer would only access it to investigate a bug you've reported or a security incident, per `docs/runbooks/incident-triage.md` and `docs/runbooks/security-incident.md`.

## 5. Attachments and uploaded files

File attachments (images, documents) you upload are stored in object storage and linked to the campaign resource you attached them to. They are scanned only for basic technical validity (file-type/magic-byte detection to confirm the upload matches its declared type) — not for content. Attachments follow the same visibility rules as the entity, session, or plot thread they're linked to.

## 6. Data retention and deletion

**Your campaign content.** You (or your campaign's owner/GM) can delete entities, sessions, attachments, and other campaign content directly through the application at any time; deleted content follows the application's normal soft-delete-then-purge behavior described in code, not an indefinite retention.

**Your account.** Worldbinder does not yet have a self-service "delete my account" feature in the application. During the Milestone 15 beta, if you want your account and associated data deleted, contact the developer directly (in person, during your beta session, per the beta's moderated design) and the account will be deleted manually. This is an honest limitation of the current beta, not a hidden practice — a self-service deletion flow is expected before any public release.

**Campaign export.** Per Worldbinder's own product principle that users own their campaign data, a complete campaign can be exported in a versioned, documented format independent of the production database schema, and later re-imported. This gives you a way to keep or move your data regardless of what happens to the hosted service.

## 7. Security

Passwords are hashed with argon2. Tokens (email verification, password reset) are hashed before storage. Refresh tokens rotate on every use, and reuse of an already-rotated token revokes the entire session family, not just that one token. See `docs/security/threat-model.md` for the full, current, honestly-stated list of protections and known gaps — we would rather describe real gaps accurately than claim security we haven't verified.

## 8. Children's privacy / age requirement

Worldbinder is not directed at children and is not intended for use by anyone under 16 years of age. We do not knowingly collect data from anyone under 16. If you believe a child has created an account, contact the developer and it will be removed.

## 9. Changes to this policy

Because Worldbinder is pre-release software under active development, this policy will change as real infrastructure (hosting, storage, email, monitoring) is actually provisioned and as account-management features (like self-service deletion) are actually built. We intend to date-stamp and describe material changes here rather than silently editing prior claims.

## 10. Contact

During the Milestone 15 beta: contact the developer directly, in person, during your testing session. A permanent contact address will be added here before any public release.

---

_Last updated: 2026-07-16 — Milestone 15 draft._
