# ADR-0007: Access token plus rotating refresh sessions

**Status:** Accepted
**Date:** 2026-07-11

## Context

Milestone 1 needed a session model that survives page reloads, supports revoking a single device without logging out every device, and detects a stolen refresh token rather than trusting it indefinitely.

## Decision

Use a short-lived (15 minute) signed JWT access token, returned in the response body and kept only in the frontend's in-memory Zustand store — never in `localStorage` — plus a long-lived (30 day) opaque refresh token stored in a `user_sessions` row and set as an `HttpOnly`, `SameSite=Lax`, path-scoped (`/auth`) cookie.

Refresh tokens rotate on every use: `POST /auth/refresh` revokes the presented session row and inserts a new one carrying the same `token_family_id`. If a refresh token is presented that matches a row already marked `revoked_at` (i.e. it was already rotated away once), the entire family is revoked immediately and the attempt is logged as a `refresh_reuse_detected` security event. This is the standard defense against a stolen refresh token being replayed after the legitimate client has already rotated past it — see roadmap §12.2.

Tokens are hashed (SHA-256) before storage; only the hash is ever persisted, matching the same rule applied to email-verification and password-reset tokens (roadmap §9.1).

## Alternatives considered

- **Long-lived JWT access token only, no refresh flow:** Simpler, but a compromised access token then stays valid for its full lifetime with no way to revoke it short of rotating the signing secret for everyone. Rejected — the roadmap's session-list/revocation workflow (§3.1) requires being able to kill one device's access promptly.
- **Refresh token as a JWT instead of an opaque token:** A signed refresh JWT can be verified without a database round trip, but revocation and reuse detection then require a separate denylist anyway, which is most of the complexity of the sessions table without any of its benefit (session metadata, "view active sessions" UI). An opaque token backed by a real row was simpler to reason about end to end.
- **Access token in an `HttpOnly` cookie too:** Would remove the need for the frontend to attach an `Authorization` header manually, but the access token would then automatically ride along on every same-site request, including ones that don't need it, and CSRF protection becomes mandatory rather than optional. Keeping the access token in memory and sent explicitly via `Authorization: Bearer` avoids that class of problem entirely; only the refresh cookie needs CSRF-relevant handling, and it's scoped to `/auth` and `SameSite=Lax`.

## Consequences

- The frontend must re-fetch a session on every full page load (`bootstrapSession()` calls `/auth/refresh` once on boot) since the access token doesn't survive a reload. This is intentional, not an oversight.
- Every `AuthService` method that mutates session state does so through the same `user_sessions` table, so "log out this device," "log out all other devices on password change," and "revoke everything on password reset" are all the same primitive (mark rows `revoked_at`) applied with different `WHERE` clauses.
- The access token JWT payload carries the current session id (`sid`), not just the user id — this makes "is this my current session" a pure client-side check (roadmap's session list UI marks the current device) without a second lookup.

## Revisit conditions

Revisit if a mobile or third-party API client is added that can't hold a refresh token in a cookie — that would need a second token-delivery mechanism (e.g. a device-bound opaque token returned directly in the response body) alongside the cookie-based web flow.
