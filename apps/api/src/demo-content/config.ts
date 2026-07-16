/**
 * Milestone 15 Phase 1 — shared constants for the demo-content build script.
 * Fixed, well-known values for this fixture only (never real accounts),
 * same precedent as `seed-perf.ts`'s `PERF_OWNER_EMAIL`/`PERF_OWNER_PASSWORD`.
 */

export const BASE_URL =
  process.env.DEMO_CONTENT_BASE_URL ?? 'http://localhost:3000';

export const DEMO_PASSWORD = 'ashgate-crossing-demo-9!';

export const DEMO_GM_EMAIL = 'demo-gm@worldbinder.local';
export const DEMO_EDITOR_EMAIL = 'demo-editor@worldbinder.local';
export const DEMO_PLAYER_EMAIL = 'demo-player@worldbinder.local';

export const DEMO_CAMPAIGN_NAME = 'Ashgate Crossing';
