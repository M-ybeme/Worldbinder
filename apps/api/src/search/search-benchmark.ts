import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../database/schema';
import { campaigns, entities } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { SearchService } from './search.service';

/**
 * Validates Milestone 7's own exit criterion (roadmap §14.4: p95 < 500ms on
 * the 10k/50k/200/2k campaign from `seed-perf.ts`) — a plain script, not a
 * Jest test, since a hard latency assertion against a shared local dev
 * Postgres would be flaky in CI. Run manually; read the printed p50/p95/p99.
 */

const PERF_CAMPAIGN_SLUG = 'search-perf-benchmark';
const RUNS_PER_QUERY = 20;
// Guaranteed present on a handful of entities by seed-perf.ts, for a
// realistic-selectivity multi-word content-phrase benchmark.
const MARKER_PHRASE = 'quloxthane vintar';

/** Builds benchmark queries from real seeded data rather than guessed
 * strings — `seed-perf.ts`'s vocabulary is combinatorial (900 words), so a
 * hardcoded word can't be guaranteed to appear with realistic selectivity
 * without re-deriving the same word list here. */
function buildQueries(sampleName: string): { label: string; q: string }[] {
  const firstWord = sampleName.split(' ')[0];
  const typoWord =
    firstWord.length > 3
      ? firstWord.slice(0, -2) + firstWord.at(-1) + firstWord.at(-2)
      : firstWord;

  return [
    { label: 'exact name', q: sampleName },
    { label: 'name prefix', q: firstWord },
    { label: 'fuzzy name (typo)', q: typoWord },
    { label: 'content word', q: 'ashwood' },
    { label: 'relationship description word', q: 'ironkeep' },
    { label: 'multi-word content phrase', q: MARKER_PHRASE },
  ];
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });

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
    .select({ name: entities.name })
    .from(entities)
    .where(eq(entities.campaignId, campaign.id))
    .limit(1);
  if (!sampleEntity) {
    console.error(
      'Seeded campaign has no entities — re-run "pnpm db:seed:perf".',
    );
    process.exit(1);
  }

  const search = new SearchService(db, new CampaignPolicyService());
  const gmMembership: CampaignMembership = {
    id: 'benchmark-membership',
    campaignId: campaign.id,
    userId: 'benchmark-user',
    role: 'gm',
    editorSecretAccess: true,
  };
  const QUERIES = buildQueries(sampleEntity.name);

  console.log(`Benchmarking search against campaign ${campaign.id}...\n`);

  const allDurations: number[] = [];

  for (const { label, q } of QUERIES) {
    const durations: number[] = [];
    for (let i = 0; i < RUNS_PER_QUERY; i += 1) {
      const start = performance.now();
      await search.search(campaign.id, gmMembership, {
        q,
        limit: 20,
        offset: 0,
      });
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    allDurations.push(...durations);

    console.log(
      `${label.padEnd(32)} p50=${percentile(durations, 50).toFixed(1)}ms  ` +
        `p95=${percentile(durations, 95).toFixed(1)}ms  ` +
        `p99=${percentile(durations, 99).toFixed(1)}ms  ` +
        `max=${durations[durations.length - 1].toFixed(1)}ms`,
    );
  }

  allDurations.sort((a, b) => a - b);
  const p95 = percentile(allDurations, 95);
  console.log(`\nOverall p95: ${p95.toFixed(1)}ms (budget: 500ms)`);
  console.log(p95 < 500 ? 'PASS' : 'FAIL — exceeds roadmap §14.4 budget');

  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
