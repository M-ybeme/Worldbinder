import { z } from 'zod'
import { entityVisibilitySchema } from './entities.js'

export const createMapSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: entityVisibilitySchema.optional(),
})
export type CreateMapInput = z.infer<typeof createMapSchema>

export const updateMapSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: entityVisibilitySchema.optional(),
  imageAttachmentId: z.string().uuid().nullable().optional(),
})
export type UpdateMapInput = z.infer<typeof updateMapSchema>

export const createMapLayerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  displayOrder: z.coerce.number().int().min(0).optional(),
  visibility: entityVisibilitySchema.optional(),
})
export type CreateMapLayerInput = z.infer<typeof createMapLayerSchema>

export const updateMapLayerSchema = createMapLayerSchema.partial()
export type UpdateMapLayerInput = z.infer<typeof updateMapLayerSchema>

// Coordinates range 0-1 inclusive (roadmap §9.12) so pins stay positioned
// across responsive image sizes.
const normalizedCoordinateSchema = z.coerce.number().min(0).max(1)

export const createMapPinSchema = z.object({
  layerId: z.string().uuid().nullable().optional(),
  locationEntityId: z.string().uuid().nullable().optional(),
  label: z.string().trim().max(200).nullable().optional(),
  xNormalized: normalizedCoordinateSchema,
  yNormalized: normalizedCoordinateSchema,
  visibility: entityVisibilitySchema.optional(),
})
export type CreateMapPinInput = z.infer<typeof createMapPinSchema>

export const updateMapPinSchema = createMapPinSchema.partial()
export type UpdateMapPinInput = z.infer<typeof updateMapPinSchema>

// Deliberately narrow — only the two coordinate fields, so a fast-firing
// drag PATCH can never clobber label/visibility/layer from a concurrent
// edit-form save.
export const repositionMapPinSchema = z.object({
  xNormalized: normalizedCoordinateSchema,
  yNormalized: normalizedCoordinateSchema,
})
export type RepositionMapPinInput = z.infer<typeof repositionMapPinSchema>
