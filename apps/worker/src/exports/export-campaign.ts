import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import {
  APPLICATION_VERSION,
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  type ArchiveManifest,
  type ExportedAttachment,
  type ExportedCampaign,
  type ExportedEntity,
  type ExportedMap,
  type ExportedMember,
  type ExportedPlotThread,
  type ExportedRelationship,
  type ExportedRelationshipType,
  type ExportedSession,
  type ExportedTag,
  type ExportedTimelineEvent,
  type ExportedWikiLink,
  type RelationshipsFile,
} from '@worldbinder/validation'
import AdmZip from 'adm-zip'
import type { Pool } from 'pg'

export interface ExportCampaignDeps {
  pool: Pool
  s3: S3Client
  bucket: string
}

/** Plain exported function (same "callable directly by tests, bypassing the
 * queue" shape as processAttachment) — builds the §17.1 archive for one
 * campaign and uploads it to storage. Raw `pg.Pool` SQL throughout, not
 * Drizzle — apps/worker is a plain process, not a NestJS app with DI. */
export async function exportCampaign(exportId: string, deps: ExportCampaignDeps): Promise<void> {
  const { pool, s3, bucket } = deps

  const { rows: exportRows } = await pool.query<{
    campaign_id: string
    requested_by_user_id: string | null
  }>('SELECT campaign_id, requested_by_user_id FROM campaign_exports WHERE id = $1', [exportId])
  const exportRow = exportRows[0]
  if (!exportRow) return // Deleted before processing reached it.

  const campaignId = exportRow.campaign_id

  await pool.query("UPDATE campaign_exports SET status = 'processing' WHERE id = $1", [exportId])

  try {
    const zip = new AdmZip()
    const checksums: Record<string, string> = {}

    const addJsonFile = (name: string, data: unknown): void => {
      const buffer = Buffer.from(JSON.stringify(data), 'utf8')
      zip.addFile(name, buffer)
      checksums[name] = createHash('sha256').update(buffer).digest('hex')
    }

    const manifest: ArchiveManifest = {
      format: ARCHIVE_FORMAT,
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      applicationVersion: APPLICATION_VERSION,
      exportedAt: new Date().toISOString(),
      campaignId,
    }
    addJsonFile('manifest.json', manifest)

    // campaign.json
    const { rows: campaignRows } = await pool.query(
      `SELECT name, description, system_name, settings_json, current_world_date_json, calendar_config_json
       FROM campaigns WHERE id = $1`,
      [campaignId],
    )
    const c = campaignRows[0]
    if (!c) throw new Error('Campaign not found')
    const campaignJson: ExportedCampaign = {
      name: c.name,
      description: c.description,
      systemName: c.system_name,
      settingsJson: c.settings_json,
      currentWorldDateJson: c.current_world_date_json,
      calendarConfigJson: c.calendar_config_json,
    }
    addJsonFile('campaign.json', campaignJson)

    // members.json — role/display name only, no emails (roadmap §17.1).
    const { rows: memberRows } = await pool.query(
      `SELECT cm.role, u.display_name FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.campaign_id = $1 AND cm.status = 'active'`,
      [campaignId],
    )
    const members: ExportedMember[] = memberRows.map((r) => ({
      role: r.role,
      displayName: r.display_name,
    }))
    addJsonFile('members.json', members)

    // tags.json
    const { rows: tagRows } = await pool.query(`SELECT id, name FROM tags WHERE campaign_id = $1`, [
      campaignId,
    ])
    const tagsJson: ExportedTag[] = tagRows.map((r) => ({ id: r.id, name: r.name }))
    addJsonFile('tags.json', tagsJson)

    // entities.json (denormalized tag names)
    const { rows: entityRows } = await pool.query(
      `SELECT id, entity_type, name, slug, summary, aliases_json, public_content_json,
              gm_content_json, metadata_json, status, visibility
       FROM entities WHERE campaign_id = $1 AND deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: entityTagRows } = await pool.query(
      `SELECT et.entity_id, t.name FROM entity_tags et
       JOIN tags t ON t.id = et.tag_id
       JOIN entities e ON e.id = et.entity_id
       WHERE e.campaign_id = $1 AND e.deleted_at IS NULL`,
      [campaignId],
    )
    const tagsByEntity = groupBy(entityTagRows, 'entity_id', 'name')
    const entitiesJson: ExportedEntity[] = entityRows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      name: r.name,
      slug: r.slug,
      summary: r.summary,
      aliasesJson: r.aliases_json,
      publicContentJson: r.public_content_json,
      gmContentJson: r.gm_content_json,
      metadataJson: r.metadata_json,
      status: r.status,
      visibility: r.visibility,
      tags: tagsByEntity.get(r.id) ?? [],
    }))
    addJsonFile('entities.json', entitiesJson)

    // relationships.json — only custom (per-campaign) types; built-in types
    // have stable ids shared across every database and are never exported.
    const { rows: customTypeRows } = await pool.query(
      `SELECT id, key, forward_label, reverse_label, allowed_source_types_json,
              allowed_target_types_json, "symmetric", allow_duplicates, default_visibility
       FROM relationship_types WHERE campaign_id = $1`,
      [campaignId],
    )
    const customTypes: ExportedRelationshipType[] = customTypeRows.map((r) => ({
      id: r.id,
      key: r.key,
      forwardLabel: r.forward_label,
      reverseLabel: r.reverse_label,
      allowedSourceTypesJson: r.allowed_source_types_json,
      allowedTargetTypesJson: r.allowed_target_types_json,
      symmetric: r.symmetric,
      allowDuplicates: r.allow_duplicates,
      defaultVisibility: r.default_visibility,
    }))
    const { rows: relRows } = await pool.query(
      `SELECT er.id, er.source_entity_id, er.target_entity_id, er.relationship_type_id,
              er.description, er.visibility
       FROM entity_relationships er
       JOIN entities se ON se.id = er.source_entity_id
       JOIN entities te ON te.id = er.target_entity_id
       WHERE er.campaign_id = $1 AND se.deleted_at IS NULL AND te.deleted_at IS NULL`,
      [campaignId],
    )
    const relationships: ExportedRelationship[] = relRows.map((r) => ({
      id: r.id,
      sourceEntityId: r.source_entity_id,
      targetEntityId: r.target_entity_id,
      relationshipTypeId: r.relationship_type_id,
      description: r.description,
      visibility: r.visibility,
    }))
    const relationshipsFile: RelationshipsFile = { customTypes, relationships }
    addJsonFile('relationships.json', relationshipsFile)

    // wiki-links.json — sourceResourceType is always 'entity' today.
    const { rows: wikiLinkRows } = await pool.query(
      `SELECT wl.id, wl.source_resource_type, wl.source_resource_id, wl.source_section,
              wl.target_entity_id, wl.display_text
       FROM entity_wiki_links wl
       JOIN entities se ON se.id = wl.source_resource_id
       JOIN entities te ON te.id = wl.target_entity_id
       WHERE wl.campaign_id = $1 AND se.deleted_at IS NULL AND te.deleted_at IS NULL
         AND wl.source_resource_type = 'entity'`,
      [campaignId],
    )
    const wikiLinks: ExportedWikiLink[] = wikiLinkRows.map((r) => ({
      id: r.id,
      sourceResourceType: 'entity',
      sourceResourceId: r.source_resource_id,
      sourceSection: r.source_section,
      targetEntityId: r.target_entity_id,
      displayText: r.display_text,
    }))
    addJsonFile('wiki-links.json', wikiLinks)

    // sessions.json — participants dropped (they reference campaign_members,
    // which aren't re-created on import; see the plan's scope notes).
    const { rows: sessionRows } = await pool.query(
      `SELECT id, session_number, title, status, scheduled_at, played_at, world_start_date_json,
              world_end_date_json, planned_content_json, recap_content_json, gm_content_json, visibility
       FROM sessions WHERE campaign_id = $1 AND deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: featuredRows } = await pool.query(
      `SELECT se.session_id, se.entity_id FROM session_entities se
       JOIN sessions s ON s.id = se.session_id
       JOIN entities e ON e.id = se.entity_id
       WHERE s.campaign_id = $1 AND e.deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: locationRows } = await pool.query(
      `SELECT sl.session_id, sl.entity_id FROM session_locations sl
       JOIN sessions s ON s.id = sl.session_id
       JOIN entities e ON e.id = sl.entity_id
       WHERE s.campaign_id = $1 AND e.deleted_at IS NULL`,
      [campaignId],
    )
    const featuredBySession = groupBy(featuredRows, 'session_id', 'entity_id')
    const locationsBySession = groupBy(locationRows, 'session_id', 'entity_id')
    const sessionsJson: ExportedSession[] = sessionRows.map((r) => ({
      id: r.id,
      sessionNumber: r.session_number,
      title: r.title,
      status: r.status,
      scheduledAt: r.scheduled_at?.toISOString() ?? null,
      playedAt: r.played_at?.toISOString() ?? null,
      worldStartDateJson: r.world_start_date_json,
      worldEndDateJson: r.world_end_date_json,
      plannedContentJson: r.planned_content_json,
      recapContentJson: r.recap_content_json,
      gmContentJson: r.gm_content_json,
      visibility: r.visibility,
      featuredEntityIds: featuredBySession.get(r.id) ?? [],
      locationEntityIds: locationsBySession.get(r.id) ?? [],
    }))
    addJsonFile('sessions.json', sessionsJson)

    // plot-threads.json
    const { rows: threadRows } = await pool.query(
      `SELECT id, title, summary, public_content_json, gm_content_json, status, importance,
              visibility, introduced_session_id, last_referenced_session_id, resolved_session_id
       FROM plot_threads WHERE campaign_id = $1 AND deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: threadEntityRows } = await pool.query(
      `SELECT pte.plot_thread_id, pte.entity_id FROM plot_thread_entities pte
       JOIN plot_threads pt ON pt.id = pte.plot_thread_id
       JOIN entities e ON e.id = pte.entity_id
       WHERE pt.campaign_id = $1 AND pt.deleted_at IS NULL AND e.deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: threadSessionRows } = await pool.query(
      `SELECT spt.plot_thread_id, spt.session_id, spt.action FROM session_plot_threads spt
       JOIN plot_threads pt ON pt.id = spt.plot_thread_id
       JOIN sessions s ON s.id = spt.session_id
       WHERE pt.campaign_id = $1 AND pt.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [campaignId],
    )
    const entitiesByThread = groupBy(threadEntityRows, 'plot_thread_id', 'entity_id')
    const sessionLinksByThread = new Map<string, { sessionId: string; action: string }[]>()
    for (const row of threadSessionRows) {
      const list = sessionLinksByThread.get(row.plot_thread_id) ?? []
      list.push({ sessionId: row.session_id, action: row.action })
      sessionLinksByThread.set(row.plot_thread_id, list)
    }
    const plotThreadsJson: ExportedPlotThread[] = threadRows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      publicContentJson: r.public_content_json,
      gmContentJson: r.gm_content_json,
      status: r.status,
      importance: r.importance,
      visibility: r.visibility,
      introducedSessionId: r.introduced_session_id,
      lastReferencedSessionId: r.last_referenced_session_id,
      resolvedSessionId: r.resolved_session_id,
      entityIds: entitiesByThread.get(r.id) ?? [],
      sessionLinks: (sessionLinksByThread.get(r.id) ?? []) as ExportedPlotThread['sessionLinks'],
    }))
    addJsonFile('plot-threads.json', plotThreadsJson)

    // maps.json — map + layers + pins nested.
    const { rows: mapRows } = await pool.query(
      `SELECT id, name, description, visibility FROM maps WHERE campaign_id = $1`,
      [campaignId],
    )
    const { rows: layerRows } = await pool.query(
      `SELECT ml.id, ml.map_id, ml.name, ml.display_order, ml.visibility
       FROM map_layers ml JOIN maps m ON m.id = ml.map_id WHERE m.campaign_id = $1`,
      [campaignId],
    )
    const { rows: pinRows } = await pool.query(
      `SELECT mp.id, mp.map_id, mp.layer_id, mp.location_entity_id, mp.label,
              mp.x_normalized, mp.y_normalized, mp.visibility
       FROM map_pins mp
       JOIN maps m ON m.id = mp.map_id
       LEFT JOIN entities e ON e.id = mp.location_entity_id
       WHERE m.campaign_id = $1 AND (mp.location_entity_id IS NULL OR e.deleted_at IS NULL)`,
      [campaignId],
    )
    const layersByMap = new Map<string, typeof layerRows>()
    for (const row of layerRows) {
      const list = layersByMap.get(row.map_id) ?? []
      list.push(row)
      layersByMap.set(row.map_id, list)
    }
    const pinsByMap = new Map<string, typeof pinRows>()
    for (const row of pinRows) {
      const list = pinsByMap.get(row.map_id) ?? []
      list.push(row)
      pinsByMap.set(row.map_id, list)
    }
    const mapsJson: ExportedMap[] = mapRows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      visibility: r.visibility,
      layers: (layersByMap.get(r.id) ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        displayOrder: l.display_order,
        visibility: l.visibility,
      })),
      pins: (pinsByMap.get(r.id) ?? []).map((p) => ({
        id: p.id,
        layerId: p.layer_id,
        locationEntityId: p.location_entity_id,
        label: p.label,
        xNormalized: p.x_normalized,
        yNormalized: p.y_normalized,
        visibility: p.visibility,
      })),
    }))
    addJsonFile('maps.json', mapsJson)

    // timeline.json
    const { rows: eventRows } = await pool.query(
      `SELECT id, title, summary, content_json, start_date_json, end_date_json, date_precision, visibility
       FROM timeline_events WHERE campaign_id = $1`,
      [campaignId],
    )
    const { rows: eventEntityRows } = await pool.query(
      `SELECT tee.timeline_event_id, tee.entity_id FROM timeline_event_entities tee
       JOIN timeline_events te ON te.id = tee.timeline_event_id
       JOIN entities e ON e.id = tee.entity_id
       WHERE te.campaign_id = $1 AND e.deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: eventSessionRows } = await pool.query(
      `SELECT tes.timeline_event_id, tes.session_id FROM timeline_event_sessions tes
       JOIN timeline_events te ON te.id = tes.timeline_event_id
       JOIN sessions s ON s.id = tes.session_id
       WHERE te.campaign_id = $1 AND s.deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: eventTagRows } = await pool.query(
      `SELECT tet.timeline_event_id, t.name FROM timeline_event_tags tet
       JOIN timeline_events te ON te.id = tet.timeline_event_id
       JOIN tags t ON t.id = tet.tag_id
       WHERE te.campaign_id = $1`,
      [campaignId],
    )
    const entitiesByEvent = groupBy(eventEntityRows, 'timeline_event_id', 'entity_id')
    const sessionsByEvent = groupBy(eventSessionRows, 'timeline_event_id', 'session_id')
    const tagsByEvent = groupBy(eventTagRows, 'timeline_event_id', 'name')
    const timelineJson: ExportedTimelineEvent[] = eventRows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      contentJson: r.content_json,
      startDateJson: r.start_date_json,
      endDateJson: r.end_date_json,
      datePrecision: r.date_precision,
      visibility: r.visibility,
      entityIds: entitiesByEvent.get(r.id) ?? [],
      sessionIds: sessionsByEvent.get(r.id) ?? [],
      tags: tagsByEvent.get(r.id) ?? [],
    }))
    addJsonFile('timeline.json', timelineJson)

    // attachments.json (metadata) + attachments/<id> (raw bytes) — a
    // documented deviation from §17.1's literal file list, which has
    // nowhere to put attachment metadata.
    const { rows: attachmentRows } = await pool.query(
      `SELECT id, storage_key, original_filename, detected_mime_type, size_bytes, sha256, width, height, visibility
       FROM attachments WHERE campaign_id = $1 AND status = 'ready' AND deleted_at IS NULL`,
      [campaignId],
    )
    const { rows: resourceLinkRows } = await pool.query(
      `SELECT ra.attachment_id, ra.resource_type, ra.resource_id, ra.display_order, ra.caption
       FROM resource_attachments ra
       JOIN attachments a ON a.id = ra.attachment_id
       WHERE a.campaign_id = $1 AND a.status = 'ready' AND a.deleted_at IS NULL`,
      [campaignId],
    )
    const linksByAttachment = new Map<string, typeof resourceLinkRows>()
    for (const row of resourceLinkRows) {
      const list = linksByAttachment.get(row.attachment_id) ?? []
      list.push(row)
      linksByAttachment.set(row.attachment_id, list)
    }

    const attachmentsJson: ExportedAttachment[] = []
    for (const r of attachmentRows) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: r.storage_key }))
      const buffer = await streamToBuffer(object.Body)
      const entryName = `attachments/${r.id}`
      zip.addFile(entryName, buffer)
      checksums[entryName] = createHash('sha256').update(buffer).digest('hex')

      attachmentsJson.push({
        id: r.id,
        originalFilename: r.original_filename,
        declaredMimeType: r.detected_mime_type,
        sizeBytes: r.size_bytes,
        sha256: r.sha256,
        width: r.width,
        height: r.height,
        visibility: r.visibility,
        resourceLinks: (linksByAttachment.get(r.id) ?? []).map((l) => ({
          resourceType: l.resource_type,
          resourceId: l.resource_id,
          displayOrder: l.display_order,
          caption: l.caption,
        })),
      })
    }
    addJsonFile('attachments.json', attachmentsJson)

    // checksums.json is last — it can't checksum itself.
    zip.addFile('checksums.json', Buffer.from(JSON.stringify(checksums), 'utf8'))

    const zipBuffer = zip.toBuffer()
    const storageKey = `exports/${campaignId}/${exportId}.zip`
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: zipBuffer }))

    await pool.query(
      `UPDATE campaign_exports
       SET status = 'ready', storage_key = $2, size_bytes = $3, completed_at = now()
       WHERE id = $1`,
      [exportId, storageKey, zipBuffer.byteLength],
    )
    await pool.query(
      `INSERT INTO campaign_audit_events (campaign_id, type, actor_user_id, metadata_json)
       VALUES ($1, 'campaign_exported', $2, $3)`,
      [campaignId, exportRow.requested_by_user_id, JSON.stringify({ exportId })],
    )
  } catch (error) {
    await pool.query(
      `UPDATE campaign_exports SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [exportId, String(error)],
    )
  }
}

function groupBy<T extends Record<string, unknown>>(
  rows: T[],
  keyField: keyof T,
  valueField: keyof T,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const key = row[keyField] as string
    const value = row[valueField] as string
    const list = map.get(key) ?? []
    list.push(value)
    map.set(key, list)
  }
  return map
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
