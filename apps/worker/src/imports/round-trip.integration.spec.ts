import { createHash, randomUUID } from 'node:crypto'
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportCampaign } from '../exports/export-campaign'
import { createS3Client } from '../storage/s3-client'
import { runImport } from './run-import'
import { validateImport } from './validate-import'

/**
 * The literal "export/import round trip passes on a large seeded campaign"
 * exit criterion (roadmap Milestone 12), against real Postgres + real
 * MinIO — not fakes. Distinct from this module's other `*.spec.ts` files
 * (which use fake pool/s3, run under plain `pnpm test`): this file runs
 * only under `pnpm test:integration` (`apps/worker`'s dedicated script),
 * same "real infra, separate command" split as apps/api's `*.e2e-spec.ts`.
 * A "representative mix across every resource type" campaign, not a
 * literal thousands-of-rows scale — that's the domain of the roadmap's
 * separate §20.6 performance testing, not this correctness test.
 */
describe('export → import round trip', () => {
  let pool: Pool
  let s3: S3Client
  let bucket: string
  let ownerUserId: string
  let importerUserId: string
  let sourceCampaignId: string
  let exportId: string
  let importId: string
  let resultCampaignId: string

  beforeAll(async () => {
    const env = loadEnv(workerEnvSchema)
    pool = new Pool({ connectionString: env.DATABASE_URL })
    s3 = createS3Client(env)
    bucket = env.STORAGE_BUCKET

    ownerUserId = randomUUID()
    importerUserId = randomUUID()
    await pool.query(
      `INSERT INTO users (id, email, display_name) VALUES ($1,$2,'Round Trip Owner'), ($3,$4,'Round Trip Importer')`,
      [
        ownerUserId,
        `round-trip-owner-${ownerUserId}@test.local`,
        importerUserId,
        `round-trip-importer-${importerUserId}@test.local`,
      ],
    )

    sourceCampaignId = await seedSourceCampaign(pool, s3, bucket, ownerUserId)
  })

  afterAll(async () => {
    await pool.query('DELETE FROM campaigns WHERE id = ANY($1)', [
      [sourceCampaignId, resultCampaignId].filter(Boolean),
    ])
    await pool.query('DELETE FROM campaign_exports WHERE id = $1', [exportId])
    await pool.query('DELETE FROM campaign_imports WHERE id = $1', [importId])
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ownerUserId, importerUserId]])
    await pool.end()
  })

  it('exports a real campaign to a downloadable archive', async () => {
    exportId = randomUUID()
    await pool.query(
      `INSERT INTO campaign_exports (id, campaign_id, requested_by_user_id, status) VALUES ($1,$2,$3,'pending')`,
      [exportId, sourceCampaignId, ownerUserId],
    )

    await exportCampaign(exportId, { pool, s3, bucket })

    const { rows } = await pool.query(
      'SELECT status, storage_key, size_bytes FROM campaign_exports WHERE id = $1',
      [exportId],
    )
    expect(rows[0].status).toBe('ready')
    expect(rows[0].storage_key).toBeTruthy()
    expect(rows[0].size_bytes).toBeGreaterThan(0)
  })

  it('validates the exported archive with a matching dry-run report', async () => {
    const { rows: exportRows } = await pool.query(
      'SELECT storage_key FROM campaign_exports WHERE id = $1',
      [exportId],
    )
    importId = randomUUID()
    await pool.query(
      `INSERT INTO campaign_imports (id, created_by_user_id, status, archive_storage_key)
       VALUES ($1,$2,'validating',$3)`,
      [importId, importerUserId, exportRows[0].storage_key],
    )

    await validateImport(importId, { pool, s3, bucket })

    const { rows } = await pool.query(
      'SELECT status, dry_run_report_json FROM campaign_imports WHERE id = $1',
      [importId],
    )
    expect(rows[0].status).toBe('dry_run_ready')
    expect(rows[0].dry_run_report_json.counts).toMatchObject({
      entities: 2,
      relationships: 1,
      sessions: 1,
      plotThreads: 1,
      maps: 1,
      mapPins: 1,
      timelineEvents: 1,
      tags: 2,
      attachments: 1,
    })
  })

  it('runs the import transactionally into a brand-new, equivalent campaign', async () => {
    await runImport(importId, { pool, s3, bucket })

    const { rows: importRows } = await pool.query(
      'SELECT status, result_campaign_id, import_report_json FROM campaign_imports WHERE id = $1',
      [importId],
    )
    expect(importRows[0].status).toBe('completed')
    resultCampaignId = importRows[0].result_campaign_id
    expect(resultCampaignId).toBeTruthy()
    expect(resultCampaignId).not.toBe(sourceCampaignId)
    expect(importRows[0].import_report_json.counts.entities).toBe(2)

    const { rows: campaignRows } = await pool.query(
      'SELECT name, owner_user_id FROM campaigns WHERE id = $1',
      [resultCampaignId],
    )
    expect(campaignRows[0].name).toBe('Round Trip Source Campaign')
    expect(campaignRows[0].owner_user_id).toBe(importerUserId)

    const { rows: entityRows } = await pool.query(
      'SELECT id, name FROM entities WHERE campaign_id = $1 ORDER BY name',
      [resultCampaignId],
    )
    expect(entityRows.map((r) => r.name)).toEqual(['Cedric', 'The Sunken City'])
    const newEntityIds = new Set(entityRows.map((r) => r.id))

    const { rows: relRows } = await pool.query(
      'SELECT description, source_entity_id, target_entity_id FROM entity_relationships WHERE campaign_id = $1',
      [resultCampaignId],
    )
    expect(relRows).toHaveLength(1)
    expect(relRows[0].description).toBe('Guards the ruins')
    expect(newEntityIds.has(relRows[0].source_entity_id)).toBe(true)
    expect(newEntityIds.has(relRows[0].target_entity_id)).toBe(true)

    const { rows: sessionRows } = await pool.query(
      'SELECT id, title FROM sessions WHERE campaign_id = $1',
      [resultCampaignId],
    )
    expect(sessionRows).toHaveLength(1)
    expect(sessionRows[0].title).toBe('Session One')

    const { rows: threadRows } = await pool.query(
      'SELECT title FROM plot_threads WHERE campaign_id = $1',
      [resultCampaignId],
    )
    expect(threadRows).toHaveLength(1)
    expect(threadRows[0].title).toBe('The Missing Caravan')

    const { rows: mapRows } = await pool.query('SELECT id, name FROM maps WHERE campaign_id = $1', [
      resultCampaignId,
    ])
    expect(mapRows).toHaveLength(1)
    const { rows: pinRows } = await pool.query(
      'SELECT location_entity_id, label FROM map_pins WHERE map_id = $1',
      [mapRows[0].id],
    )
    expect(pinRows).toHaveLength(1)
    expect(newEntityIds.has(pinRows[0].location_entity_id)).toBe(true)

    const { rows: eventRows } = await pool.query(
      'SELECT title FROM timeline_events WHERE campaign_id = $1',
      [resultCampaignId],
    )
    expect(eventRows).toHaveLength(1)
    expect(eventRows[0].title).toBe('The Founding')

    const { rows: attachmentRows } = await pool.query(
      "SELECT id, sha256, status FROM attachments WHERE campaign_id = $1 AND status = 'ready'",
      [resultCampaignId],
    )
    expect(attachmentRows).toHaveLength(1)
    const { rows: sourceAttachmentRows } = await pool.query(
      'SELECT sha256 FROM attachments WHERE campaign_id = $1',
      [sourceCampaignId],
    )
    expect(attachmentRows[0].sha256).toBe(sourceAttachmentRows[0].sha256)

    const { rows: linkRows } = await pool.query(
      'SELECT resource_type, resource_id FROM resource_attachments WHERE attachment_id = $1',
      [attachmentRows[0].id],
    )
    expect(linkRows).toHaveLength(1)
    expect(newEntityIds.has(linkRows[0].resource_id)).toBe(true)
  })
})

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function seedSourceCampaign(
  pool: Pool,
  s3: S3Client,
  bucket: string,
  ownerUserId: string,
): Promise<string> {
  const campaignId = randomUUID()
  await pool.query(
    `INSERT INTO campaigns (id, owner_user_id, name, slug, status) VALUES ($1,$2,'Round Trip Source Campaign',$3,'active')`,
    [campaignId, ownerUserId, `round-trip-source-${campaignId}`],
  )
  await pool.query(
    `INSERT INTO campaign_members (id, campaign_id, user_id, role) VALUES ($1,$2,$3,'owner')`,
    [randomUUID(), campaignId, ownerUserId],
  )

  const tagAId = randomUUID()
  const tagBId = randomUUID()
  await pool.query(
    `INSERT INTO tags (id, campaign_id, name, normalized_name) VALUES ($1,$2,'npc','npc'), ($3,$2,'ruins','ruins')`,
    [tagAId, campaignId, tagBId],
  )

  const entityAId = randomUUID() // Cedric, an NPC
  const entityBId = randomUUID() // The Sunken City, a location
  await pool.query(
    `INSERT INTO entities (id, campaign_id, entity_type, name, slug, summary, status, visibility, created_by_user_id, updated_by_user_id)
     VALUES ($1,$2,'character','Cedric','cedric','A guard captain.','published','public',$3,$3)`,
    [entityAId, campaignId, ownerUserId],
  )
  await pool.query(
    `INSERT INTO entities (id, campaign_id, entity_type, name, slug, summary, status, visibility, created_by_user_id, updated_by_user_id)
     VALUES ($1,$2,'location','The Sunken City','the-sunken-city','Ruins offshore.','published','public',$3,$3)`,
    [entityBId, campaignId, ownerUserId],
  )
  await pool.query(`INSERT INTO entity_tags (entity_id, tag_id) VALUES ($1,$2), ($3,$4)`, [
    entityAId,
    tagAId,
    entityBId,
    tagBId,
  ])

  const customTypeId = randomUUID()
  await pool.query(
    `INSERT INTO relationship_types (id, campaign_id, key, forward_label, reverse_label, "symmetric", default_visibility)
     VALUES ($1,$2,'guards','Guards','Guarded by',false,'public')`,
    [customTypeId, campaignId],
  )
  await pool.query(
    `INSERT INTO entity_relationships
       (id, campaign_id, source_entity_id, target_entity_id, relationship_type_id, description, visibility, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,'Guards the ruins','public',$6)`,
    [randomUUID(), campaignId, entityAId, entityBId, customTypeId, ownerUserId],
  )

  const sessionId = randomUUID()
  await pool.query(
    `INSERT INTO sessions (id, campaign_id, session_number, title, status, visibility, created_by_user_id, updated_by_user_id)
     VALUES ($1,$2,1,'Session One','completed','public',$3,$3)`,
    [sessionId, campaignId, ownerUserId],
  )
  await pool.query(`INSERT INTO session_entities (session_id, entity_id) VALUES ($1,$2)`, [
    sessionId,
    entityAId,
  ])

  const threadId = randomUUID()
  await pool.query(
    `INSERT INTO plot_threads (id, campaign_id, title, status, importance, visibility, created_by_user_id, updated_by_user_id)
     VALUES ($1,$2,'The Missing Caravan','active','standard','public',$3,$3)`,
    [threadId, campaignId, ownerUserId],
  )
  await pool.query(`INSERT INTO plot_thread_entities (plot_thread_id, entity_id) VALUES ($1,$2)`, [
    threadId,
    entityAId,
  ])
  await pool.query(
    `INSERT INTO session_plot_threads (session_id, plot_thread_id, action) VALUES ($1,$2,'introduced')`,
    [sessionId, threadId],
  )

  const mapId = randomUUID()
  await pool.query(
    `INSERT INTO maps (id, campaign_id, name, visibility) VALUES ($1,$2,'Region Map','public')`,
    [mapId, campaignId],
  )
  const layerId = randomUUID()
  await pool.query(
    `INSERT INTO map_layers (id, map_id, name, display_order, visibility) VALUES ($1,$2,'Cities',0,'public')`,
    [layerId, mapId],
  )
  await pool.query(
    `INSERT INTO map_pins (id, map_id, layer_id, location_entity_id, label, x_normalized, y_normalized, visibility)
     VALUES ($1,$2,$3,$4,'Cedric''s post',0.5,0.5,'public')`,
    [randomUUID(), mapId, layerId, entityAId],
  )

  const eventId = randomUUID()
  await pool.query(
    `INSERT INTO timeline_events (id, campaign_id, title, start_date_json, date_precision, visibility)
     VALUES ($1,$2,'The Founding',$3,'year','public')`,
    [eventId, campaignId, JSON.stringify({ schemaVersion: 1, year: 100 })],
  )
  await pool.query(
    `INSERT INTO timeline_event_entities (timeline_event_id, entity_id) VALUES ($1,$2)`,
    [eventId, entityBId],
  )
  await pool.query(
    `INSERT INTO timeline_event_sessions (timeline_event_id, session_id) VALUES ($1,$2)`,
    [eventId, sessionId],
  )
  await pool.query(`INSERT INTO timeline_event_tags (timeline_event_id, tag_id) VALUES ($1,$2)`, [
    eventId,
    tagBId,
  ])

  const attachmentId = randomUUID()
  const storageKey = `attachments/${campaignId}/${attachmentId}`
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: VALID_PNG }))
  const sha256 = createHash('sha256').update(VALID_PNG).digest('hex')
  await pool.query(
    `INSERT INTO attachments
       (id, campaign_id, storage_key, original_filename, detected_mime_type, size_bytes, sha256, width, height, status, visibility)
     VALUES ($1,$2,$3,'fixture.png','image/png',$4,$5,1,1,'ready','public')`,
    [attachmentId, campaignId, storageKey, VALID_PNG.byteLength, sha256],
  )
  await pool.query(
    `INSERT INTO resource_attachments (attachment_id, resource_type, resource_id, display_order)
     VALUES ($1,'entity',$2,0)`,
    [attachmentId, entityAId],
  )

  return campaignId
}
