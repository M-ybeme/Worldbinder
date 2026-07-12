import { z } from 'zod'
import { entityTypeSchema, entityVisibilitySchema } from './entities.js'

const uuidField = z.string().uuid()

export const createRelationshipTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only'),
  forwardLabel: z.string().trim().min(1).max(100),
  reverseLabel: z.string().trim().min(1).max(100),
  allowedSourceTypes: z.array(entityTypeSchema).optional(),
  allowedTargetTypes: z.array(entityTypeSchema).optional(),
  symmetric: z.boolean().optional(),
  allowDuplicates: z.boolean().optional(),
  defaultVisibility: entityVisibilitySchema.optional(),
})
export type CreateRelationshipTypeInput = z.infer<typeof createRelationshipTypeSchema>

export const createRelationshipSchema = z.object({
  sourceEntityId: uuidField,
  targetEntityId: uuidField,
  relationshipTypeId: uuidField,
  description: z.string().trim().max(1000).optional(),
  visibility: entityVisibilitySchema.optional(),
})
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>

export const updateRelationshipSchema = z.object({
  description: z.string().trim().max(1000).nullable().optional(),
  visibility: entityVisibilitySchema.optional(),
})
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>
