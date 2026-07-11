import { defineConfig, devices } from '@playwright/test'

/**
 * Early scaffolding for the roadmap's §20.4 "critical Playwright suite" —
 * pulled forward from Milestone 13/20 to verify Milestone 2 through a real
 * browser instead of only via curl. Assumes `pnpm infra:up` and `pnpm dev`
 * are already running (same precondition as `pnpm test:integration`); this
 * deliberately does not use Playwright's `webServer` auto-start, since the
 * app needs Postgres/Redis/Mailpit plus three processes, not one.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  // This scenario is one long sequential flow (two accounts, several page
  // loads, two Mailpit polling loops up to ~20s each) rather than a single
  // quick interaction — the 30s default test timeout is tuned for the
  // latter and fires mid-flow, not because anything is actually stuck.
  timeout: 150_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
