import { randomUUID } from 'node:crypto';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import type { EntityType, TiptapDoc } from '@worldbinder/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  buildWeightedTsvector,
  extractPlainText,
} from '../search/search-vector.util';
import {
  campaignMembers,
  campaigns,
  entities,
  entityRelationships,
  plotThreads,
  relationshipTypes,
  sessions,
  users,
} from './schema';

/**
 * Milestone 7's own exit criterion — "search meets performance budget on a
 * seeded large campaign" (roadmap §14.4: 10k entities / 50k relationships /
 * 200 sessions / 2k plot threads, p95 < 500ms) — needs *some* concrete
 * fixture to validate against now, not just a promise to build one later.
 * This is a deliberately narrow, standalone script for that one exit
 * criterion, NOT the full §20.6 cross-feature profiling suite (dashboard,
 * entity details, relationship queries, exports, imports) — that belongs to
 * Milestone 14 ("Performance, Security, and Reliability Hardening").
 *
 * Inserts directly via Drizzle, bypassing the NestJS service layer — going
 * through full HTTP/service calls one row at a time would take far too
 * long for a "run this before a search PR" workflow at this volume. tsvector
 * columns are still built with the exact same `search-vector.util.ts`
 * functions the real services use, so the fixture's data shape matches
 * production writes, not a special-cased backfill.
 */

const ENTITY_COUNT = 10_000;
const SESSION_COUNT = 200;
const PLOT_THREAD_COUNT = 2_000;
const RELATIONSHIP_COUNT = 50_000;
const BATCH_SIZE = 500;

const PERF_CAMPAIGN_SLUG = 'search-perf-benchmark';
const PERF_OWNER_EMAIL = 'search-perf-owner@worldbinder.local';

const ENTITY_TYPES: EntityType[] = [
  'character',
  'location',
  'faction',
  'organization',
  'item',
  'deity',
  'creature',
  'event',
  'quest',
  'lore',
];

// Combinatorial vocabulary (30 x 30 = 900 distinct words), not a small fixed
// list — real campaign prose is lexically diverse. A small word bank made
// every "content word" query match nearly the entire 10k-row table, which
// made Postgres's planner correctly choose a sequential scan over an
// unselective index (verified via EXPLAIN ANALYZE) — not a search bug, but
// not a realistic benchmark either. ~900 words at this document length
// keeps any single word's expected selectivity in the low single digits.
const SYLLABLE_A = [
  'ash',
  'iron',
  'wolf',
  'stone',
  'ember',
  'thorn',
  'frost',
  'gale',
  'raven',
  'oak',
  'storm',
  'moon',
  'sun',
  'shadow',
  'blood',
  'silver',
  'gold',
  'night',
  'dawn',
  'dusk',
  'quartz',
  'cinder',
  'briar',
  'wren',
  'salt',
  'amber',
  'copper',
  'flint',
  'bramble',
  'hollow',
];
const SYLLABLE_B = [
  'wood',
  'fall',
  'hold',
  'reach',
  'gate',
  'vale',
  'spire',
  'crest',
  'mere',
  'ridge',
  'hollow',
  'watch',
  'ford',
  'haven',
  'moor',
  'glen',
  'keep',
  'run',
  'shire',
  'wick',
  'barrow',
  'cross',
  'mark',
  'stead',
  'wright',
  'bridge',
  'field',
  'grove',
  'harbor',
  'thorpe',
];
const WORD_BANK = SYLLABLE_A.flatMap((a) => SYLLABLE_B.map((b) => `${a}${b}`));

// A handful of entities get this exact rare phrase inserted into their
// content, so a realistic-selectivity "exact phrase" content-match query
// has a guaranteed, small, non-empty result set to benchmark against.
const MARKER_PHRASE = 'quloxthane vintar';
const MARKER_ENTITY_COUNT = 5;

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomWords(count: number): string {
  return Array.from(
    { length: count },
    () => WORD_BANK[randomInt(WORD_BANK.length)],
  ).join(' ');
}

function randomSentence(): string {
  const words = randomWords(6 + randomInt(8));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

function randomDoc(paragraphs: number): TiptapDoc {
  return {
    type: 'doc',
    content: Array.from({ length: paragraphs }, () => ({
      type: 'paragraph',
      content: [
        { type: 'text', text: `${randomSentence()} ${randomSentence()}` },
      ],
    })),
  };
}

async function insertInBatches<T>(
  label: string,
  rows: T[],
  insertBatch: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await insertBatch(batch);
    process.stdout.write(
      `\r${label}: ${Math.min(offset + BATCH_SIZE, rows.length)}/${rows.length}`,
    );
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Seeding performance campaign "${PERF_CAMPAIGN_SLUG}"...`);

  await db.delete(campaigns).where(eq(campaigns.slug, PERF_CAMPAIGN_SLUG));

  const [owner] = await db
    .insert(users)
    .values({
      email: PERF_OWNER_EMAIL,
      displayName: 'Search Perf Owner',
      emailVerifiedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { displayName: 'Search Perf Owner' },
    })
    .returning({ id: users.id });
  if (!owner) throw new Error('Failed to create/resolve perf owner user');

  const [campaign] = await db
    .insert(campaigns)
    .values({
      ownerUserId: owner.id,
      name: 'Search Performance Benchmark',
      slug: PERF_CAMPAIGN_SLUG,
      status: 'active',
    })
    .returning({ id: campaigns.id });
  if (!campaign) throw new Error('Failed to create perf campaign');

  await db
    .insert(campaignMembers)
    .values({ campaignId: campaign.id, userId: owner.id, role: 'owner' })
    .onConflictDoNothing();

  const [relType] = await db
    .insert(relationshipTypes)
    .values({
      campaignId: campaign.id,
      key: 'perf-benchmark-link',
      forwardLabel: 'Linked to',
      reverseLabel: 'Linked from',
      symmetric: false,
      allowDuplicates: true,
    })
    .returning({ id: relationshipTypes.id });
  if (!relType) throw new Error('Failed to create perf relationship type');

  // --- Entities ---
  const entityIds: string[] = [];
  const entityRows = Array.from({ length: ENTITY_COUNT }, (_, i) => {
    const id = randomUUID();
    entityIds.push(id);
    const entityType = ENTITY_TYPES[i % ENTITY_TYPES.length];
    const name = `${randomWords(2)} ${i}`;
    const summary = randomSentence();
    const publicContentJson = randomDoc(2 + randomInt(3));
    if (i < MARKER_ENTITY_COUNT) {
      publicContentJson.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `Bound by the ${MARKER_PHRASE}.` }],
      });
    }
    const gmContentJson = randomDoc(1 + randomInt(2));
    const publicText = extractPlainText(publicContentJson);
    const gmText = extractPlainText(gmContentJson);

    return {
      id,
      campaignId: campaign.id,
      entityType,
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(0, 8)}`,
      summary,
      publicContentJson,
      gmContentJson,
      status: 'published' as const,
      visibility: i % 10 === 0 ? ('gm_only' as const) : ('public' as const),
      createdByUserId: owner.id,
      updatedByUserId: owner.id,
      searchVectorPublic: buildWeightedTsvector({
        a: [name],
        b: [summary],
        c: [publicText],
      }),
      searchVectorGm: buildWeightedTsvector({
        a: [name],
        b: [summary],
        c: [publicText, gmText],
      }),
    };
  });
  await insertInBatches('Entities', entityRows, (batch) =>
    db
      .insert(entities)
      .values(batch)
      .then(() => undefined),
  );

  // --- Sessions ---
  const sessionIds: string[] = [];
  const sessionRows = Array.from({ length: SESSION_COUNT }, (_, i) => {
    const id = randomUUID();
    sessionIds.push(id);
    const title = `Session ${i + 1}: ${randomWords(3)}`;
    const recapContentJson = randomDoc(2);
    const recapText = extractPlainText(recapContentJson);

    return {
      id,
      campaignId: campaign.id,
      sessionNumber: i + 1,
      title,
      status: 'completed' as const,
      recapContentJson,
      visibility: 'public' as const,
      createdByUserId: owner.id,
      updatedByUserId: owner.id,
      searchVectorPublic: buildWeightedTsvector({ a: [title], c: [recapText] }),
      searchVectorGm: buildWeightedTsvector({ a: [title], c: [recapText] }),
    };
  });
  await insertInBatches('Sessions', sessionRows, (batch) =>
    db
      .insert(sessions)
      .values(batch)
      .then(() => undefined),
  );

  // --- Plot threads ---
  const plotThreadRows = Array.from({ length: PLOT_THREAD_COUNT }, (_, i) => {
    const title = `Thread ${i}: ${randomWords(3)}`;
    const summary = randomSentence();
    const publicContentJson = randomDoc(1 + randomInt(2));
    const publicText = extractPlainText(publicContentJson);

    return {
      campaignId: campaign.id,
      title,
      summary,
      publicContentJson,
      status: 'active' as const,
      importance: 'standard' as const,
      visibility: 'public' as const,
      createdByUserId: owner.id,
      updatedByUserId: owner.id,
      searchVectorPublic: buildWeightedTsvector({
        a: [title],
        b: [summary],
        c: [publicText],
      }),
      searchVectorGm: buildWeightedTsvector({
        a: [title],
        b: [summary],
        c: [publicText],
      }),
    };
  });
  await insertInBatches('Plot threads', plotThreadRows, (batch) =>
    db
      .insert(plotThreads)
      .values(batch)
      .then(() => undefined),
  );

  // --- Relationships ---
  const relationshipRows = Array.from({ length: RELATIONSHIP_COUNT }, () => {
    const sourceEntityId = entityIds[randomInt(entityIds.length)];
    let targetEntityId = entityIds[randomInt(entityIds.length)];
    while (targetEntityId === sourceEntityId) {
      targetEntityId = entityIds[randomInt(entityIds.length)]!;
    }
    const description = randomSentence();

    return {
      campaignId: campaign.id,
      sourceEntityId,
      targetEntityId,
      relationshipTypeId: relType.id,
      description,
      visibility: 'public' as const,
      createdByUserId: owner.id,
      searchVector: buildWeightedTsvector({ d: [description] }),
    };
  });
  await insertInBatches('Relationships', relationshipRows, (batch) =>
    db
      .insert(entityRelationships)
      .values(batch)
      .then(() => undefined),
  );

  console.log(
    `\nDone. Campaign id: ${campaign.id} (slug: ${PERF_CAMPAIGN_SLUG})`,
  );
  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Perf seed failed:', error);
  process.exit(1);
});
