import autocannon from 'autocannon';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  PERF_CAMPAIGN_SLUG,
  PERF_OWNER_EMAIL,
  PERF_OWNER_PASSWORD,
} from '../database/seed-perf';
import { campaigns, entities } from '../database/schema';

/**
 * Milestone 14 Phase 8 — real concurrent HTTP load against a running dev
 * server (`pnpm dev`, or at minimum the API alone), profiling the read-heavy
 * routes §20.6 names against the §22.2 budgets (simple reads/writes <300ms/
 * <500ms, search <500ms). Requires `pnpm db:seed:perf` to have been run
 * first. A plain script, not a Jest test — a hard latency assertion against
 * shared local infra would be flaky in CI, same reasoning as
 * `search/search-benchmark.ts`.
 *
 * Export/import aren't profiled here: they're single background jobs, not
 * concurrent-request endpoints, so a connections/duration HTTP benchmark
 * doesn't fit them — see `apps/worker/src/load-test/export-import-benchmark.ts`
 * for their wall-clock-timing equivalent.
 *
 * autocannon has no exact p95 bucket (only p90/p97_5) — p97_5 is reported
 * and used as the (slightly stricter) stand-in for the roadmap's p95 budget.
 *
 * Bounded by request COUNT (`amount`), not duration: Phase 5's
 * `GlobalRateLimitGuard` buckets by client IP at 300 requests/60s, and every
 * target below shares that one bucket (a loopback benchmark can't spread
 * across multiple real client IPs the way production traffic would). 5
 * targets x 40 requests = 200, comfortably under 300 for the whole run —
 * this is a genuine, permanent per-IP abuse ceiling working as designed
 * (Phase 5), not something Phase 8 should fight; this harness measures
 * per-request latency at a volume beneath it, not raw unthrottled
 * throughput capacity.
 */

const BASE_URL = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3000';
const CONNECTIONS = 5;
const REQUESTS_PER_TARGET = 40;

interface Budget {
  path: string;
  method: 'GET' | 'POST';
  budgetMs: number;
  budgetLabel: string;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: PERF_OWNER_EMAIL,
      password: PERF_OWNER_PASSWORD,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}) — run "pnpm db:seed:perf" first, and make sure the API is running.`,
    );
  }
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function runTarget(
  target: Budget,
  headers: Record<string, string>,
): Promise<void> {
  const result = await autocannon({
    url: `${BASE_URL}${target.path}`,
    method: target.method,
    headers,
    connections: CONNECTIONS,
    amount: REQUESTS_PER_TARGET,
  });

  const { p50, p90, p97_5: p975, p99 } = result.latency;
  const pass = p975 < target.budgetMs;
  console.log(
    `${target.path.padEnd(58)} p50=${p50}ms  p90=${p90}ms  p97.5=${p975}ms  p99=${p99}ms  ` +
      `2xx=${result['2xx']}  non2xx=${result.non2xx}  errors=${result.errors}`,
  );
  console.log(
    `  budget: ${target.budgetLabel} (${target.budgetMs}ms) — ` +
      (pass ? 'PASS' : `FAIL — p97.5 exceeds budget`),
  );
}

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, PERF_CAMPAIGN_SLUG));
  if (!campaign) {
    console.error(
      `No campaign with slug "${PERF_CAMPAIGN_SLUG}" found — run "pnpm db:seed:perf" first.`,
    );
    process.exit(1);
  }

  const [sampleEntity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.campaignId, campaign.id))
    .limit(1);
  if (!sampleEntity) {
    console.error(
      'Seeded campaign has no entities — re-run "pnpm db:seed:perf".',
    );
    process.exit(1);
  }
  await pool.end();

  console.log(`Logging in as ${PERF_OWNER_EMAIL}...`);
  const accessToken = await login();
  const headers = { authorization: `Bearer ${accessToken}` };

  const targets: Budget[] = [
    {
      path: '/campaigns',
      method: 'GET',
      budgetMs: 300,
      budgetLabel: 'simple read',
    },
    {
      path: `/campaigns/${campaign.id}/dashboard`,
      method: 'GET',
      budgetMs: 300,
      budgetLabel: 'simple read',
    },
    {
      path: `/campaigns/${campaign.id}/entities/${sampleEntity.id}`,
      method: 'GET',
      budgetMs: 300,
      budgetLabel: 'simple read',
    },
    {
      path: `/campaigns/${campaign.id}/entities/${sampleEntity.id}/relationships`,
      method: 'GET',
      budgetMs: 300,
      budgetLabel: 'simple read',
    },
    {
      path: `/campaigns/${campaign.id}/search?q=ashwood&limit=20`,
      method: 'GET',
      budgetMs: 500,
      budgetLabel: 'search',
    },
  ];

  console.log(
    `\nRunning load test (${CONNECTIONS} connections, ${REQUESTS_PER_TARGET} requests each) against ${BASE_URL}...\n`,
  );

  for (const target of targets) {
    await runTarget(target, headers);
  }
}

main().catch((error: unknown) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
