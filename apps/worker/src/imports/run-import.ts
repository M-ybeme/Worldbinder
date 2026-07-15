import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { ImportReport } from '@worldbinder/contracts'
import { imageSize } from 'image-size'
import type { Pool, PoolClient } from 'pg'
import { deleteObjectBestEffort } from '../storage/s3-client'
import { detectValidAttachments, openArchive, ValidationFailure } from './archive'

export interface RunImportDeps {
  pool: Pool
  s3: S3Client
  bucket: string
}

/** Plain exported function. One Postgres transaction end to end — any
 * failure rolls back every insert, which is the concrete mechanism behind
 * "failed import leaves no partial data." Insertion order is
 * dependency-driven: a table is only written once every id it might
 * reference has already been remapped. */
export async function runImport(importId: string, deps: RunImportDeps): Promise<void> {
  const { pool, s3, bucket } = deps

  const { rows } = await pool.query<{
    archive_storage_key: string
    created_by_user_id: string
  }>('SELECT archive_storage_key, created_by_user_id FROM campaign_imports WHERE id = $1', [
    importId,
  ])
  const row = rows[0]
  if (!row) return

  const uploadedKeys: string[] = []
  const client = await pool.connect()

  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: row.archive_storage_key }),
    )
    const archiveBuffer = await streamToBuffer(object.Body)
    const archive = openArchive(archiveBuffer)
    const { validAttachments, warnings } = detectValidAttachments(
      archive.attachmentsMeta,
      archive.contents,
    )

    await client.query('BEGIN')

    // 1. Campaign + owner membership. The importing user becomes the sole
    // real member — old member roles/labels are historical only (see the
    // plan's scope notes), never re-created as live campaign_members rows.
    const campaignId = randomUUID()
    const slug = await generateUniqueSlug(client, archive.campaign.name)
    await client.query(
      `INSERT INTO campaigns
         (id, owner_user_id, name, slug, description, system_name, status,
          settings_json, current_world_date_json, calendar_config_json)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9)`,
      [
        campaignId,
        row.created_by_user_id,
        archive.campaign.name,
        slug,
        archive.campaign.description,
        archive.campaign.systemName,
        toJson(archive.campaign.settingsJson),
        toJson(archive.campaign.currentWorldDateJson),
        toJson(archive.campaign.calendarConfigJson),
      ],
    )
    await client.query(
      `INSERT INTO campaign_members (id, campaign_id, user_id, role) VALUES ($1,$2,$3,'owner')`,
      [randomUUID(), campaignId, row.created_by_user_id],
    )

    // 2. Tags — find-or-create by normalized name (same pattern as
    // EntitiesService's syncTags), so two exports sharing a tag name never
    // collide with themselves; here it's simply create, since this is a
    // brand-new campaign with no pre-existing tags.
    const tagIdMap = new Map<string, string>()
    for (const tag of archive.tags) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO tags (id, campaign_id, name, normalized_name) VALUES ($1,$2,$3,$4)`,
        [newId, campaignId, tag.name, normalizeTagName(tag.name)],
      )
      tagIdMap.set(tag.id, newId)
    }

    // 3. Custom relationship types, found-or-created by key. Built-in
    // types (campaign_id IS NULL) have stable ids seeded identically in
    // every database — their ids pass through unchanged, never remapped.
    const typeIdMap = new Map<string, string>()
    for (const type of archive.relationships.customTypes) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO relationship_types
           (id, campaign_id, key, forward_label, reverse_label,
            allowed_source_types_json, allowed_target_types_json, "symmetric",
            allow_duplicates, default_visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          newId,
          campaignId,
          type.key,
          type.forwardLabel,
          type.reverseLabel,
          toJson(type.allowedSourceTypesJson),
          toJson(type.allowedTargetTypesJson),
          type.symmetric,
          type.allowDuplicates,
          type.defaultVisibility,
        ],
      )
      typeIdMap.set(type.id, newId)
    }
    const resolveRelationshipTypeId = (oldId: string): string => typeIdMap.get(oldId) ?? oldId

    // 4. Entities (+ entity_tags), search vectors built inline.
    const entityIdMap = new Map<string, string>()
    for (const entity of archive.entities) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO entities
           (id, campaign_id, entity_type, name, slug, summary, aliases_json,
            public_content_json, gm_content_json, metadata_json, status,
            visibility, created_by_user_id, updated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [
          newId,
          campaignId,
          entity.entityType,
          entity.name,
          entity.slug,
          entity.summary,
          toJson(entity.aliasesJson),
          toJson(entity.publicContentJson),
          toJson(entity.gmContentJson),
          toJson(entity.metadataJson),
          entity.status,
          entity.visibility,
          row.created_by_user_id,
        ],
      )
      entityIdMap.set(entity.id, newId)

      for (const tagName of entity.tags) {
        const tagId = tagIdMap.get(findTagIdByName(archive.tags, tagName))
        if (tagId) {
          await client.query(
            `INSERT INTO entity_tags (entity_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, tagId],
          )
        }
      }

      const publicText = extractPlainText(entity.publicContentJson)
      const gmText = extractPlainText(entity.gmContentJson)
      const a = joinPieces([entity.name])
      const b = joinPieces([...entity.tags, entity.summary ?? ''])
      await client.query(
        `UPDATE entities SET
           search_vector_public = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $3), 'B') || setweight(to_tsvector('english', $4), 'C'),
           search_vector_gm = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $3), 'B') || setweight(to_tsvector('english', $5), 'C')
         WHERE id = $1`,
        [newId, a, b, publicText, joinPieces([publicText, gmText])],
      )
    }

    // 5. entity_relationships
    for (const rel of archive.relationships.relationships) {
      const sourceId = entityIdMap.get(rel.sourceEntityId)
      const targetId = entityIdMap.get(rel.targetEntityId)
      if (!sourceId || !targetId) continue // Referenced a since-deleted entity — already excluded from the export.
      const searchVector = joinPieces([rel.description ?? ''])
      await client.query(
        `INSERT INTO entity_relationships
           (id, campaign_id, source_entity_id, target_entity_id, relationship_type_id,
            description, visibility, created_by_user_id, search_vector)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, setweight(to_tsvector('english', $9), 'D'))`,
        [
          randomUUID(),
          campaignId,
          sourceId,
          targetId,
          resolveRelationshipTypeId(rel.relationshipTypeId),
          rel.description,
          rel.visibility,
          row.created_by_user_id,
          searchVector,
        ],
      )
    }

    // 6. Sessions — participants intentionally dropped (see scope notes).
    const sessionIdMap = new Map<string, string>()
    for (const session of archive.sessions) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO sessions
           (id, campaign_id, session_number, title, status, scheduled_at, played_at,
            world_start_date_json, world_end_date_json, planned_content_json,
            recap_content_json, gm_content_json, visibility, created_by_user_id, updated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
        [
          newId,
          campaignId,
          session.sessionNumber,
          session.title,
          session.status,
          session.scheduledAt,
          session.playedAt,
          toJson(session.worldStartDateJson),
          toJson(session.worldEndDateJson),
          toJson(session.plannedContentJson),
          toJson(session.recapContentJson),
          toJson(session.gmContentJson),
          session.visibility,
          row.created_by_user_id,
        ],
      )
      sessionIdMap.set(session.id, newId)

      for (const oldEntityId of session.featuredEntityIds) {
        const entityId = entityIdMap.get(oldEntityId)
        if (entityId) {
          await client.query(
            `INSERT INTO session_entities (session_id, entity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, entityId],
          )
        }
      }
      for (const oldEntityId of session.locationEntityIds) {
        const entityId = entityIdMap.get(oldEntityId)
        if (entityId) {
          await client.query(
            `INSERT INTO session_locations (session_id, entity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, entityId],
          )
        }
      }

      const publicText = extractPlainText(session.recapContentJson)
      const plannedText = extractPlainText(session.plannedContentJson)
      const gmText = extractPlainText(session.gmContentJson)
      const a = joinPieces([session.title])
      await client.query(
        `UPDATE sessions SET
           search_vector_public = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $3), 'C'),
           search_vector_gm = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $4), 'C')
         WHERE id = $1`,
        [newId, a, publicText, joinPieces([publicText, plannedText, gmText])],
      )
    }

    // 7. Plot threads.
    const threadIdMap = new Map<string, string>()
    for (const thread of archive.plotThreads) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO plot_threads
           (id, campaign_id, title, summary, public_content_json, gm_content_json, status,
            importance, visibility, introduced_session_id, last_referenced_session_id,
            resolved_session_id, created_by_user_id, updated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [
          newId,
          campaignId,
          thread.title,
          thread.summary,
          toJson(thread.publicContentJson),
          toJson(thread.gmContentJson),
          thread.status,
          thread.importance,
          thread.visibility,
          thread.introducedSessionId
            ? (sessionIdMap.get(thread.introducedSessionId) ?? null)
            : null,
          thread.lastReferencedSessionId
            ? (sessionIdMap.get(thread.lastReferencedSessionId) ?? null)
            : null,
          thread.resolvedSessionId ? (sessionIdMap.get(thread.resolvedSessionId) ?? null) : null,
          row.created_by_user_id,
        ],
      )
      threadIdMap.set(thread.id, newId)

      for (const oldEntityId of thread.entityIds) {
        const entityId = entityIdMap.get(oldEntityId)
        if (entityId) {
          await client.query(
            `INSERT INTO plot_thread_entities (plot_thread_id, entity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, entityId],
          )
        }
      }
      for (const link of thread.sessionLinks) {
        const sessionId = sessionIdMap.get(link.sessionId)
        if (sessionId) {
          await client.query(
            `INSERT INTO session_plot_threads (session_id, plot_thread_id, action) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [sessionId, newId, link.action],
          )
        }
      }

      const publicText = extractPlainText(thread.publicContentJson)
      const gmText = extractPlainText(thread.gmContentJson)
      const a = joinPieces([thread.title])
      const b = joinPieces([thread.summary ?? ''])
      await client.query(
        `UPDATE plot_threads SET
           search_vector_public = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $3), 'B') || setweight(to_tsvector('english', $4), 'C'),
           search_vector_gm = setweight(to_tsvector('english', $2), 'A') || setweight(to_tsvector('english', $3), 'B') || setweight(to_tsvector('english', $5), 'C')
         WHERE id = $1`,
        [newId, a, b, publicText, joinPieces([publicText, gmText])],
      )
    }

    // 8. entity_wiki_links — sourceResourceType is always 'entity' today.
    for (const link of archive.wikiLinks) {
      const sourceId = entityIdMap.get(link.sourceResourceId)
      const targetId = entityIdMap.get(link.targetEntityId)
      if (!sourceId || !targetId) continue
      await client.query(
        `INSERT INTO entity_wiki_links
           (id, campaign_id, source_resource_type, source_resource_id, source_section,
            target_entity_id, display_text)
         VALUES ($1,$2,'entity',$3,$4,$5,$6)`,
        [randomUUID(), campaignId, sourceId, link.sourceSection, targetId, link.displayText],
      )
    }

    // 9. Maps → layers → pins, per-map layer-id map.
    for (const map of archive.maps) {
      const newMapId = randomUUID()
      await client.query(
        `INSERT INTO maps (id, campaign_id, name, description, visibility)
         VALUES ($1,$2,$3,$4,$5)`,
        [newMapId, campaignId, map.name, map.description, map.visibility],
      )

      const layerIdMap = new Map<string, string>()
      for (const layer of map.layers) {
        const newLayerId = randomUUID()
        await client.query(
          `INSERT INTO map_layers (id, map_id, name, display_order, visibility)
           VALUES ($1,$2,$3,$4,$5)`,
          [newLayerId, newMapId, layer.name, layer.displayOrder, layer.visibility],
        )
        layerIdMap.set(layer.id, newLayerId)
      }

      for (const pin of map.pins) {
        const locationEntityId = pin.locationEntityId
          ? (entityIdMap.get(pin.locationEntityId) ?? null)
          : null
        await client.query(
          `INSERT INTO map_pins
             (id, map_id, layer_id, location_entity_id, label, x_normalized, y_normalized, visibility)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            randomUUID(),
            newMapId,
            pin.layerId ? (layerIdMap.get(pin.layerId) ?? null) : null,
            locationEntityId,
            pin.label,
            pin.xNormalized,
            pin.yNormalized,
            pin.visibility,
          ],
        )
      }
    }

    // 10. Timeline events (+ entity/session/tag links), single search vector.
    for (const event of archive.timeline) {
      const newId = randomUUID()
      await client.query(
        `INSERT INTO timeline_events
           (id, campaign_id, title, summary, content_json, start_date_json, end_date_json,
            date_precision, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId,
          campaignId,
          event.title,
          event.summary,
          toJson(event.contentJson),
          toJson(event.startDateJson),
          toJson(event.endDateJson),
          event.datePrecision,
          event.visibility,
        ],
      )

      for (const oldEntityId of event.entityIds) {
        const entityId = entityIdMap.get(oldEntityId)
        if (entityId) {
          await client.query(
            `INSERT INTO timeline_event_entities (timeline_event_id, entity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, entityId],
          )
        }
      }
      for (const oldSessionId of event.sessionIds) {
        const sessionId = sessionIdMap.get(oldSessionId)
        if (sessionId) {
          await client.query(
            `INSERT INTO timeline_event_sessions (timeline_event_id, session_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, sessionId],
          )
        }
      }
      for (const tagName of event.tags) {
        const tagId = tagIdMap.get(findTagIdByName(archive.tags, tagName))
        if (tagId) {
          await client.query(
            `INSERT INTO timeline_event_tags (timeline_event_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newId, tagId],
          )
        }
      }

      const text = joinPieces([
        event.title,
        event.summary ?? '',
        extractPlainText(event.contentJson),
      ])
      await client.query(
        `UPDATE timeline_events SET search_vector = setweight(to_tsvector('english', $2), 'A') WHERE id = $1`,
        [newId, text],
      )
    }

    // 11. Attachments — re-upload bytes to a new storage key under the new
    // campaign; only ids that survived detectValidAttachments() are
    // imported (declared metadata is never trusted for width/height/mime).
    const attachmentIdMap = new Map<string, string>()
    for (const meta of archive.attachmentsMeta) {
      const detectedMimeType = validAttachments.get(meta.id)
      if (!detectedMimeType) continue

      const bytes = archive.contents.get(`attachments/${meta.id}`)!
      const newId = randomUUID()
      const storageKey = `attachments/${campaignId}/${newId}`

      let width: number | null = null
      let height: number | null = null
      if (detectedMimeType.startsWith('image/')) {
        try {
          const size = imageSize(bytes)
          width = size.width
          height = size.height
        } catch {
          continue // Corrupt image despite passing magic-byte detection — skip.
        }
      }

      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: bytes }))
      uploadedKeys.push(storageKey)

      const sha256 = createHash('sha256').update(bytes).digest('hex')
      await client.query(
        `INSERT INTO attachments
           (id, campaign_id, storage_key, original_filename, detected_mime_type, size_bytes,
            sha256, width, height, status, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ready',$10)`,
        [
          newId,
          campaignId,
          storageKey,
          meta.originalFilename,
          detectedMimeType,
          bytes.byteLength,
          sha256,
          width,
          height,
          meta.visibility,
        ],
      )
      attachmentIdMap.set(meta.id, newId)
    }

    // 12. resource_attachments.
    for (const meta of archive.attachmentsMeta) {
      const newAttachmentId = attachmentIdMap.get(meta.id)
      if (!newAttachmentId) continue

      for (const link of meta.resourceLinks) {
        const resourceId = resolveResourceId(
          link.resourceType,
          link.resourceId,
          entityIdMap,
          sessionIdMap,
          threadIdMap,
        )
        if (!resourceId) continue
        await client.query(
          `INSERT INTO resource_attachments (attachment_id, resource_type, resource_id, display_order, caption)
           VALUES ($1,$2,$3,$4,$5)`,
          [newAttachmentId, link.resourceType, resourceId, link.displayOrder, link.caption],
        )
      }
    }

    // 13. Audit event on the new campaign.
    await client.query(
      `INSERT INTO campaign_audit_events (campaign_id, type, actor_user_id, metadata_json)
       VALUES ($1, 'campaign_imported', $2, $3)`,
      [campaignId, row.created_by_user_id, JSON.stringify({ importId })],
    )

    await client.query('COMMIT')

    const mapPinCount = archive.maps.reduce((sum, m) => sum + m.pins.length, 0)
    const report: ImportReport = {
      counts: {
        entities: archive.entities.length,
        relationships: archive.relationships.relationships.length,
        wikiLinks: archive.wikiLinks.length,
        sessions: archive.sessions.length,
        plotThreads: archive.plotThreads.length,
        maps: archive.maps.length,
        mapPins: mapPinCount,
        timelineEvents: archive.timeline.length,
        tags: archive.tags.length,
        members: archive.members.length,
        attachments: attachmentIdMap.size,
      },
      warnings,
    }

    await pool.query(
      `UPDATE campaign_imports
       SET status = 'completed', import_report_json = $2, result_campaign_id = $3, completed_at = now()
       WHERE id = $1`,
      [importId, JSON.stringify(report), campaignId],
    )
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    for (const key of uploadedKeys) await deleteObjectBestEffort(s3, bucket, key)

    const message = error instanceof ValidationFailure ? error.message : String(error)
    await pool.query(
      `UPDATE campaign_imports SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [importId, message],
    )
  } finally {
    client.release()
  }
}

function resolveResourceId(
  resourceType: string,
  oldResourceId: string,
  entityIdMap: Map<string, string>,
  sessionIdMap: Map<string, string>,
  threadIdMap: Map<string, string>,
): string | null {
  switch (resourceType) {
    case 'entity':
      return entityIdMap.get(oldResourceId) ?? null
    case 'session':
      return sessionIdMap.get(oldResourceId) ?? null
    case 'plot_thread':
      return threadIdMap.get(oldResourceId) ?? null
    default:
      return null
  }
}

function findTagIdByName(tags: { id: string; name: string }[], name: string): string {
  return tags.find((t) => t.name === name)?.id ?? ''
}

function joinPieces(pieces: (string | null | undefined)[]): string {
  return pieces.filter((p): p is string => !!p && p.trim().length > 0).join(' ')
}

function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  const pieces: string[] = []
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const typed = node as { type?: string; text?: unknown; content?: unknown[] }
    if (typed.type === 'text' && typeof typed.text === 'string') pieces.push(typed.text)
    if (Array.isArray(typed.content)) for (const child of typed.content) visit(child)
  }
  visit(doc)
  return pieces.join(' ').replace(/\s+/g, ' ').trim()
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function generateUniqueSlug(client: PoolClient, name: string): Promise<string> {
  const base = slugify(name) || 'campaign'
  let candidate = base
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await client.query('SELECT id FROM campaigns WHERE slug = $1', [candidate])
    if (rows.length === 0) return candidate
    candidate = `${base}-${randomBytes(3).toString('hex')}`
  }
  throw new Error('Failed to generate a unique campaign slug')
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
