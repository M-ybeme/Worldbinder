import { z } from 'zod'
import {
  calendarConfigSchema,
  timelineDatePrecisionSchema,
  timelineDateSchema,
  worldDateSchema,
} from './calendar.js'
import {
  entityStatusSchema,
  entityTypeSchema,
  entityVisibilitySchema,
  tiptapDocSchema,
} from './entities.js'
import {
  plotThreadImportanceSchema,
  plotThreadSessionActionSchema,
  plotThreadStatusSchema,
} from './plot-threads.js'
import { sessionStatusSchema } from './sessions.js'

// Milestone 12 — Export and Import. §17's archive format is the single
// source of truth for both directions: `exportCampaign()` (apps/worker)
// builds JSON documents matching these shapes, `validateImport()`
// (apps/worker) parses an uploaded archive's documents against them.

export const ARCHIVE_FORMAT = 'worldbinder-campaign'
export const ARCHIVE_SCHEMA_VERSION = '1.0.0'
export const APPLICATION_VERSION = '1.0.0'

// Documented judgment calls, same spirit as ATTACHMENT_MAX_SIZE_BYTES.
export const MAX_IMPORT_ARCHIVE_SIZE_BYTES = 200_000_000 // 200MB
export const MAX_IMPORT_ENTRY_COUNT = 10_000
export const MAX_JSON_ENTRY_SIZE_BYTES = 50_000_000 // 50MB per non-attachment file

export const manifestSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT),
  schemaVersion: z.string(),
  applicationVersion: z.string(),
  exportedAt: z.string(),
  campaignId: z.string().uuid(),
})
export type ArchiveManifest = z.infer<typeof manifestSchema>

const uuidField = z.string().uuid()

export const presignImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.coerce.number().int().positive().max(MAX_IMPORT_ARCHIVE_SIZE_BYTES),
})
export type PresignImportInput = z.infer<typeof presignImportSchema>

// --- campaign.json ---

export const exportedCampaignSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  systemName: z.string().nullable(),
  settingsJson: z.record(z.string(), z.unknown()).nullable(),
  currentWorldDateJson: worldDateSchema.nullable(),
  calendarConfigJson: calendarConfigSchema.nullable(),
})
export type ExportedCampaign = z.infer<typeof exportedCampaignSchema>

// --- members.json ---
// Role/display-name only, never emails (roadmap §17.1) — not re-imported
// as live campaign_members rows, exported for historical reference only.

export const exportedMemberSchema = z.object({
  role: z.enum(['owner', 'gm', 'editor', 'player', 'viewer']),
  displayName: z.string(),
})
export type ExportedMember = z.infer<typeof exportedMemberSchema>
export const membersFileSchema = z.array(exportedMemberSchema)

// --- tags.json ---

export const exportedTagSchema = z.object({
  id: uuidField,
  name: z.string(),
})
export type ExportedTag = z.infer<typeof exportedTagSchema>
export const tagsFileSchema = z.array(exportedTagSchema)

// --- relationships.json ---
// Built-in relationship types (stable ids seeded identically in every
// database) are never included — only per-campaign custom types are.

export const exportedRelationshipTypeSchema = z.object({
  id: uuidField,
  key: z.string(),
  forwardLabel: z.string(),
  reverseLabel: z.string(),
  allowedSourceTypesJson: z.array(entityTypeSchema).nullable(),
  allowedTargetTypesJson: z.array(entityTypeSchema).nullable(),
  symmetric: z.boolean(),
  allowDuplicates: z.boolean(),
  defaultVisibility: entityVisibilitySchema,
})
export type ExportedRelationshipType = z.infer<typeof exportedRelationshipTypeSchema>

export const exportedRelationshipSchema = z.object({
  id: uuidField,
  sourceEntityId: uuidField,
  targetEntityId: uuidField,
  relationshipTypeId: uuidField,
  description: z.string().nullable(),
  visibility: entityVisibilitySchema,
})
export type ExportedRelationship = z.infer<typeof exportedRelationshipSchema>

export const relationshipsFileSchema = z.object({
  customTypes: z.array(exportedRelationshipTypeSchema),
  relationships: z.array(exportedRelationshipSchema),
})
export type RelationshipsFile = z.infer<typeof relationshipsFileSchema>

// --- entities.json ---

export const exportedEntitySchema = z.object({
  id: uuidField,
  entityType: entityTypeSchema,
  name: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  aliasesJson: z.array(z.string()).nullable(),
  publicContentJson: tiptapDocSchema.nullable(),
  gmContentJson: tiptapDocSchema.nullable(),
  metadataJson: z.record(z.string(), z.unknown()).nullable(),
  status: entityStatusSchema,
  visibility: entityVisibilitySchema,
  tags: z.array(z.string()),
})
export type ExportedEntity = z.infer<typeof exportedEntitySchema>
export const entitiesFileSchema = z.array(exportedEntitySchema)

// --- wiki-links.json ---
// sourceResourceType is always 'entity' today (schema.ts's own comment) —
// only the entity id map is needed to remap both ends on import.

export const exportedWikiLinkSchema = z.object({
  id: uuidField,
  sourceResourceType: z.literal('entity'),
  sourceResourceId: uuidField,
  sourceSection: z.enum(['public', 'gm']),
  targetEntityId: uuidField,
  displayText: z.string(),
})
export type ExportedWikiLink = z.infer<typeof exportedWikiLinkSchema>
export const wikiLinksFileSchema = z.array(exportedWikiLinkSchema)

// --- sessions.json ---
// Participants (which reference campaign_members) are deliberately
// omitted — see the plan's scope notes.

export const exportedSessionSchema = z.object({
  id: uuidField,
  sessionNumber: z.number().int(),
  title: z.string(),
  status: sessionStatusSchema,
  scheduledAt: z.string().nullable(),
  playedAt: z.string().nullable(),
  worldStartDateJson: worldDateSchema.nullable(),
  worldEndDateJson: worldDateSchema.nullable(),
  plannedContentJson: tiptapDocSchema.nullable(),
  recapContentJson: tiptapDocSchema.nullable(),
  gmContentJson: tiptapDocSchema.nullable(),
  visibility: entityVisibilitySchema,
  featuredEntityIds: z.array(uuidField),
  locationEntityIds: z.array(uuidField),
})
export type ExportedSession = z.infer<typeof exportedSessionSchema>
export const sessionsFileSchema = z.array(exportedSessionSchema)

// --- plot-threads.json ---

export const exportedPlotThreadSchema = z.object({
  id: uuidField,
  title: z.string(),
  summary: z.string().nullable(),
  publicContentJson: tiptapDocSchema.nullable(),
  gmContentJson: tiptapDocSchema.nullable(),
  status: plotThreadStatusSchema,
  importance: plotThreadImportanceSchema,
  visibility: entityVisibilitySchema,
  introducedSessionId: uuidField.nullable(),
  lastReferencedSessionId: uuidField.nullable(),
  resolvedSessionId: uuidField.nullable(),
  entityIds: z.array(uuidField),
  sessionLinks: z.array(z.object({ sessionId: uuidField, action: plotThreadSessionActionSchema })),
})
export type ExportedPlotThread = z.infer<typeof exportedPlotThreadSchema>
export const plotThreadsFileSchema = z.array(exportedPlotThreadSchema)

// --- maps.json ---

export const exportedMapLayerSchema = z.object({
  id: uuidField,
  name: z.string(),
  displayOrder: z.number().int(),
  visibility: entityVisibilitySchema,
})
export const exportedMapPinSchema = z.object({
  id: uuidField,
  layerId: uuidField.nullable(),
  locationEntityId: uuidField.nullable(),
  label: z.string().nullable(),
  xNormalized: z.number(),
  yNormalized: z.number(),
  visibility: entityVisibilitySchema,
})
export const exportedMapSchema = z.object({
  id: uuidField,
  name: z.string(),
  description: z.string().nullable(),
  visibility: entityVisibilitySchema,
  layers: z.array(exportedMapLayerSchema),
  pins: z.array(exportedMapPinSchema),
})
export type ExportedMap = z.infer<typeof exportedMapSchema>
export const mapsFileSchema = z.array(exportedMapSchema)

// --- timeline.json ---

export const exportedTimelineEventSchema = z.object({
  id: uuidField,
  title: z.string(),
  summary: z.string().nullable(),
  contentJson: tiptapDocSchema.nullable(),
  startDateJson: timelineDateSchema.nullable(),
  endDateJson: timelineDateSchema.nullable(),
  datePrecision: timelineDatePrecisionSchema.nullable(),
  visibility: entityVisibilitySchema,
  entityIds: z.array(uuidField),
  sessionIds: z.array(uuidField),
  tags: z.array(z.string()),
})
export type ExportedTimelineEvent = z.infer<typeof exportedTimelineEventSchema>
export const timelineFileSchema = z.array(exportedTimelineEventSchema)

// --- attachments.json (metadata; raw bytes live under attachments/<id>) ---
// A documented deviation from §17.1's literal file list, which has nowhere
// to put attachment metadata.

export const exportedAttachmentSchema = z.object({
  id: uuidField,
  originalFilename: z.string(),
  declaredMimeType: z.string().nullable(),
  sizeBytes: z.number().int(),
  sha256: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  visibility: entityVisibilitySchema,
  resourceLinks: z.array(
    z.object({
      resourceType: z.enum(['entity', 'session', 'plot_thread']),
      resourceId: uuidField,
      displayOrder: z.number().int(),
      caption: z.string().nullable(),
    }),
  ),
})
export type ExportedAttachment = z.infer<typeof exportedAttachmentSchema>
export const attachmentsFileSchema = z.array(exportedAttachmentSchema)
