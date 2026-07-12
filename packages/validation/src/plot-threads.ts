import { z } from 'zod'
import { entityVisibilitySchema, tiptapDocSchema } from './entities.js'

export const plotThreadStatusSchema = z.enum([
  'foreshadowed',
  'active',
  'dormant',
  'resolved',
  'abandoned',
])
export type PlotThreadStatus = z.infer<typeof plotThreadStatusSchema>

export const plotThreadImportanceSchema = z.enum(['minor', 'standard', 'major', 'critical'])
export type PlotThreadImportance = z.infer<typeof plotThreadImportanceSchema>

export const plotThreadSessionActionSchema = z.enum(['introduced', 'advanced', 'resolved'])
export type PlotThreadSessionAction = z.infer<typeof plotThreadSessionActionSchema>

const uuidField = z.string().uuid()

export const createPlotThreadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  publicContentJson: tiptapDocSchema.optional(),
  gmContentJson: tiptapDocSchema.optional(),
  importance: plotThreadImportanceSchema.optional(),
  visibility: entityVisibilitySchema.optional(),
  entityIds: z.array(uuidField).optional(),
})
export type CreatePlotThreadInput = z.infer<typeof createPlotThreadSchema>

export const updatePlotThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  publicContentJson: tiptapDocSchema.nullable().optional(),
  gmContentJson: tiptapDocSchema.nullable().optional(),
  status: plotThreadStatusSchema.optional(),
  importance: plotThreadImportanceSchema.optional(),
  visibility: entityVisibilitySchema.optional(),
  entityIds: z.array(uuidField).optional(),
  // Required: the client's last-known version, for optimistic concurrency
  // (roadmap §15.2) — same convention as UpdateEntityInput/UpdateSessionInput.
  updatedAt: z.string().datetime(),
})
export type UpdatePlotThreadInput = z.infer<typeof updatePlotThreadSchema>
