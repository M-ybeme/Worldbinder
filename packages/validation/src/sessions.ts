import { z } from 'zod'
import { worldDateSchema } from './calendar.js'
import { entityVisibilitySchema, tiptapDocSchema } from './entities.js'
import { plotThreadSessionActionSchema } from './plot-threads.js'

export const sessionStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'cancelled'])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

const uuidField = z.string().uuid()

const plotThreadChangeSchema = z.object({
  plotThreadId: uuidField,
  action: plotThreadSessionActionSchema,
})
export type PlotThreadChangeInput = z.infer<typeof plotThreadChangeSchema>

const sessionJoinFields = {
  participantIds: z.array(uuidField).optional(),
  featuredEntityIds: z.array(uuidField).optional(),
  locationEntityIds: z.array(uuidField).optional(),
  plotThreadChanges: z.array(plotThreadChangeSchema).optional(),
}

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  scheduledAt: z.string().datetime().optional(),
  worldStartDateJson: worldDateSchema.optional(),
  plannedContentJson: tiptapDocSchema.optional(),
  visibility: entityVisibilitySchema.optional(),
  ...sessionJoinFields,
})
export type CreateSessionInput = z.infer<typeof createSessionSchema>

export const updateSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: sessionStatusSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  playedAt: z.string().datetime().nullable().optional(),
  worldStartDateJson: worldDateSchema.nullable().optional(),
  worldEndDateJson: worldDateSchema.nullable().optional(),
  plannedContentJson: tiptapDocSchema.nullable().optional(),
  recapContentJson: tiptapDocSchema.nullable().optional(),
  gmContentJson: tiptapDocSchema.nullable().optional(),
  visibility: entityVisibilitySchema.optional(),
  // Required: the client's last-known version, for optimistic concurrency
  // (roadmap §15.2) — same convention as UpdateEntityInput.
  updatedAt: z.string().datetime(),
  ...sessionJoinFields,
})
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>

export const completeSessionSchema = z.object({
  recapContentJson: tiptapDocSchema.optional(),
  worldEndDateJson: worldDateSchema.optional(),
  playedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
})
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>

export const revealEntitySchema = z.object({
  entityId: uuidField,
})
export type RevealEntityInput = z.infer<typeof revealEntitySchema>
