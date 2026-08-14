/**
 * Milestone 15 Phase 1 — shared constants for the demo-content build script.
 * Fixed, well-known values for this fixture only (never real accounts),
 * same precedent as `seed-perf.ts`'s `PERF_OWNER_EMAIL`/`PERF_OWNER_PASSWORD`.
 */

export const BASE_URL =
  process.env.DEMO_CONTENT_BASE_URL ?? 'http://localhost:3000';

/** Local dev verifies new demo accounts by polling Mailpit for the real
 * verification email (see mailpit.ts). Production has no Mailpit — mail
 * goes through Resend's HTTP API instead (ADR-0022) — so this flag swaps
 * to marking `users.emailVerifiedAt` directly via a DB connection instead,
 * the same no-token-flow shortcut `database/seed.ts` already uses for its
 * own seeded account. Opt-in and explicit rather than inferred from
 * BASE_URL, so a mistaken production run against Mailpit-less
 * infrastructure fails loudly (no email ever arrives to poll for) instead
 * of silently doing the wrong thing. */
export const VERIFY_VIA_DB = process.env.DEMO_CONTENT_VERIFY_VIA_DB === 'true';

export const DEMO_PASSWORD = 'ashgate-crossing-demo-9!';

export const DEMO_GM_EMAIL = 'demo-gm@worldbinder.local';
export const DEMO_EDITOR_EMAIL = 'demo-editor@worldbinder.local';
export const DEMO_PLAYER_EMAIL = 'demo-player@worldbinder.local';

export const DEMO_CAMPAIGN_NAME = 'Ashgate Crossing';
