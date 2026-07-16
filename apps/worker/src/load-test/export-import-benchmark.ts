import { randomUUID } from 'node:crypto'
import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import { Pool } from 'pg'
import { exportCampaign } from '../exports/export-campaign'
import { runImport } from '../imports/run-import'
import { validateImport } from '../imports/validate-import'
import { createS3Client } from '../storage/s3-client'

/**
 * Milestone 14 Phase 8 — times the actual export/import pipeline (not a
 * concurrent-request benchmark; §22.2 treats these as background jobs that
 * "may take longer but must report status", so wall-clock duration plus
 * correctness is what matters here, not p95 under concurrency) against the
 * full `search-perf-benchmark` campaign from `seed-perf.ts` (10k entities /
 * 50k relationships / 2k plot threads / 200 sessions / 500 timeline events /
 * 20 maps) — the first time export/import has been exercised at anywhere
 * near this scale; `round-trip.integration.spec.ts` only covers a
 * one-of-each-type fixture for correctness, not volume.
 *
 * Calls the worker's own `exportCampaign`/`validateImport`/`runImport`
 * functions directly against real Postgres/MinIO, the same "plain function,
 * bypass the queue" entry point `round-trip.integration.spec.ts` uses — a
 * real BullMQ round trip would only add queue-scheduling latency on top of
 * the thing actually being profiled.
 *
 * Requires `pnpm db:seed:perf` to have been run first. Cleans up the
 * imported result campaign (and its own export/import tracking rows) at the
 * end so repeated runs don't accumulate junk in local dev Postgres/MinIO —
 * the original seeded campaign is left untouched.
 */

const PERF_CAMPAIGN_SLUG = 'search-perf-benchmark'

function ms(startedAt: bigint): string {
  return (Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(0)
}

async function main(): Promise<void> {
  const env = loadEnv(workerEnvSchema)
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const s3 = createS3Client(env)
  const bucket = env.STORAGE_BUCKET

  const { rows: campaignRows } = await pool.query<{ id: string; owner_user_id: string }>(
    'SELECT id, owner_user_id FROM campaigns WHERE slug = $1',
    [PERF_CAMPAIGN_SLUG],
  )
  const campaign = campaignRows[0]
  if (!campaign) {
    console.error(`No campaign with slug "${PERF_CAMPAIGN_SLUG}" found — run "pnpm db:seed:perf" first.`)
    process.exit(1)
  }

  console.log(`Benchmarking export/import against campaign ${campaign.id}...\n`)

  // --- Export ---
  const exportId = randomUUID()
  await pool.query(
    `INSERT INTO campaign_exports (id, campaign_id, requested_by_user_id, status) VALUES ($1,$2,$3,'pending')`,
    [exportId, campaign.id, campaign.owner_user_id],
  )
  let start = process.hrtime.bigint()
  await exportCampaign(exportId, { pool, s3, bucket })
  const exportDurationMs = ms(start)

  const { rows: exportRows } = await pool.query<{
    status: string
    storage_key: string | null
    size_bytes: number | null
  }>('SELECT status, storage_key, size_bytes FROM campaign_exports WHERE id = $1', [exportId])
  const exportRow = exportRows[0]
  const exportOk = exportRow?.status === 'ready' && !!exportRow.storage_key
  console.log(
    `Export:   ${exportDurationMs}ms  status=${exportRow?.status}  ` +
      `size=${((exportRow?.size_bytes ?? 0) / 1_000_000).toFixed(1)}MB  ${exportOk ? 'PASS' : 'FAIL'}`,
  )
  if (!exportOk || !exportRow?.storage_key) {
    console.error('Export did not complete — aborting import benchmark.')
    await pool.end()
    process.exit(1)
  }

  // --- Import: validate (dry run) ---
  const importId = randomUUID()
  await pool.query(
    `INSERT INTO campaign_imports (id, created_by_user_id, status, archive_storage_key)
     VALUES ($1,$2,'validating',$3)`,
    [importId, campaign.owner_user_id, exportRow.storage_key],
  )
  start = process.hrtime.bigint()
  await validateImport(importId, { pool, s3, bucket })
  const validateDurationMs = ms(start)

  const { rows: dryRunRows } = await pool.query<{
    status: string
    dry_run_report_json: { counts: Record<string, number>; warnings: string[] } | null
  }>('SELECT status, dry_run_report_json FROM campaign_imports WHERE id = $1', [importId])
  const dryRunRow = dryRunRows[0]
  const counts = dryRunRow?.dry_run_report_json?.counts ?? {}
  const expectedCounts: Record<string, number> = {
    entities: 10_000,
    relationships: 50_000,
    sessions: 200,
    plotThreads: 2_000,
    timelineEvents: 500,
    maps: 20,
  }
  const countsMatch = Object.entries(expectedCounts).every(
    ([key, expected]) => counts[key] === expected,
  )
  console.log(
    `Validate: ${validateDurationMs}ms  status=${dryRunRow?.status}  ` +
      `counts=${JSON.stringify(counts)}  ${countsMatch && dryRunRow?.status === 'dry_run_ready' ? 'PASS' : 'FAIL'}`,
  )

  // --- Import: run ---
  start = process.hrtime.bigint()
  await runImport(importId, { pool, s3, bucket })
  const runDurationMs = ms(start)

  const { rows: importRows } = await pool.query<{
    status: string
    result_campaign_id: string | null
  }>('SELECT status, result_campaign_id FROM campaign_imports WHERE id = $1', [importId])
  const importRow = importRows[0]
  const importOk = importRow?.status === 'completed' && !!importRow.result_campaign_id
  console.log(`Run:      ${runDurationMs}ms  status=${importRow?.status}  ${importOk ? 'PASS' : 'FAIL'}`)

  if (importRow?.result_campaign_id) {
    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT count(*) FROM entities WHERE campaign_id = $1',
      [importRow.result_campaign_id],
    )
    console.log(`Imported campaign entity count: ${countRows[0]?.count}`)
  }

  console.log(
    `\nTotal wall time (export + validate + run): ${
      Number(exportDurationMs) + Number(validateDurationMs) + Number(runDurationMs)
    }ms`,
  )

  // --- Cleanup: remove the imported result campaign + this run's tracking
  // rows, leaving the original seeded campaign and MinIO export object
  // untouched (harmless to leave, but deleting keeps repeated runs tidy).
  if (importRow?.result_campaign_id) {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [importRow.result_campaign_id])
  }
  await pool.query('DELETE FROM campaign_imports WHERE id = $1', [importId])
  await pool.query('DELETE FROM campaign_exports WHERE id = $1', [exportId])

  await pool.end()
}

main().catch((error: unknown) => {
  console.error('Export/import benchmark failed:', error)
  process.exit(1)
})
