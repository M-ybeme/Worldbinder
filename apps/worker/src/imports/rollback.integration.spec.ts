import { createHash, randomUUID } from 'node:crypto'
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { loadEnv, workerEnvSchema } from '@worldbinder/config'
import { ARCHIVE_FORMAT, ARCHIVE_SCHEMA_VERSION } from '@worldbinder/validation'
import AdmZip from 'adm-zip'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createS3Client } from '../storage/s3-client'
import { runImport } from './run-import'

/**
 * The literal "failed import leaves no partial data" exit criterion
 * (roadmap Milestone 12), against real Postgres — not a mock. The
 * transaction is forced to fail partway through (a relationship
 * referencing a relationship-type id that doesn't exist, a genuine FK
 * violation) *after* the campaign/entities/tags have already been
 * inserted, so a passing test here is only meaningful because those
 * earlier inserts are provably gone afterward, not just never attempted.
 */
describe('runImport rollback', () => {
  let pool: Pool
  let s3: S3Client
  let bucket: string
  let importerUserId: string
  let importId: string
  const campaignName = `Rollback Test Campaign ${randomUUID()}`

  beforeAll(async () => {
    const env = loadEnv(workerEnvSchema)
    pool = new Pool({ connectionString: env.DATABASE_URL })
    s3 = createS3Client(env)
    bucket = env.STORAGE_BUCKET

    importerUserId = randomUUID()
    await pool.query(`INSERT INTO users (id, email, display_name) VALUES ($1,$2,'Rollback Importer')`, [
      importerUserId,
      `rollback-importer-${importerUserId}@test.local`,
    ])
  })

  afterAll(async () => {
    await pool.query('DELETE FROM campaign_imports WHERE id = $1', [importId])
    await pool.query('DELETE FROM users WHERE id = $1', [importerUserId])
    await pool.end()
  })

  it('rolls back every insert when a later step hits a real constraint violation', async () => {
    const archiveBuffer = buildArchiveWithBadRelationshipType(campaignName)
    const storageKey = `imports/rollback-fixture-${randomUUID()}.zip`
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: archiveBuffer }))

    importId = randomUUID()
    await pool.query(
      `INSERT INTO campaign_imports (id, created_by_user_id, status, archive_storage_key)
       VALUES ($1,$2,'importing',$3)`,
      [importId, importerUserId, storageKey],
    )

    await runImport(importId, { pool, s3, bucket })

    const { rows: importRows } = await pool.query(
      'SELECT status, error_message, result_campaign_id FROM campaign_imports WHERE id = $1',
      [importId],
    )
    expect(importRows[0].status).toBe('failed')
    expect(importRows[0].error_message).toBeTruthy()
    expect(importRows[0].result_campaign_id).toBeNull()

    // The real assertion: the campaign (and everything under it — entities,
    // tags) that got inserted *before* the failing relationship insert must
    // not have survived the rollback.
    const { rows: campaignRows } = await pool.query('SELECT id FROM campaigns WHERE name = $1', [
      campaignName,
    ])
    expect(campaignRows).toHaveLength(0)
  })
})

function buildArchiveWithBadRelationshipType(campaignName: string): Buffer {
  const zip = new AdmZip()
  const checksums: Record<string, string> = {}

  const addJson = (name: string, data: unknown) => {
    const buf = Buffer.from(JSON.stringify(data), 'utf8')
    zip.addFile(name, buf)
    checksums[name] = createHash('sha256').update(buf).digest('hex')
  }

  addJson('manifest.json', {
    format: ARCHIVE_FORMAT,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    applicationVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    campaignId: randomUUID(),
  })
  addJson('campaign.json', {
    name: campaignName,
    description: null,
    systemName: null,
    settingsJson: null,
    currentWorldDateJson: null,
    calendarConfigJson: null,
  })
  addJson('members.json', [])
  addJson('tags.json', [])

  const entityAId = randomUUID()
  const entityBId = randomUUID()
  addJson('entities.json', [
    {
      id: entityAId,
      entityType: 'character',
      name: 'Doomed Entity A',
      slug: 'doomed-entity-a',
      summary: null,
      aliasesJson: null,
      publicContentJson: null,
      gmContentJson: null,
      metadataJson: null,
      status: 'published',
      visibility: 'public',
      tags: [],
    },
    {
      id: entityBId,
      entityType: 'character',
      name: 'Doomed Entity B',
      slug: 'doomed-entity-b',
      summary: null,
      aliasesJson: null,
      publicContentJson: null,
      gmContentJson: null,
      metadataJson: null,
      status: 'published',
      visibility: 'public',
      tags: [],
    },
  ])

  // Neither a custom type in this archive nor a real built-in id — the
  // FK constraint on entity_relationships.relationship_type_id will reject
  // this at insert time, forcing the rollback this test exists to prove.
  addJson('relationships.json', {
    customTypes: [],
    relationships: [
      {
        id: randomUUID(),
        sourceEntityId: entityAId,
        targetEntityId: entityBId,
        relationshipTypeId: randomUUID(),
        description: null,
        visibility: 'public',
      },
    ],
  })

  addJson('wiki-links.json', [])
  addJson('sessions.json', [])
  addJson('plot-threads.json', [])
  addJson('maps.json', [])
  addJson('timeline.json', [])
  addJson('attachments.json', [])

  zip.addFile('checksums.json', Buffer.from(JSON.stringify(checksums), 'utf8'))
  return zip.toBuffer()
}
