import { z } from 'zod'

export const entityTypeSchema = z.enum([
  'character',
  'location',
  'faction',
  'organization',
  'item',
  'deity',
  'creature',
  'event',
  'quest',
  'lore',
  'custom',
])
export type EntityType = z.infer<typeof entityTypeSchema>

export const entityStatusSchema = z.enum(['draft', 'published', 'archived'])
export const entityVisibilitySchema = z.enum(['public', 'gm_only'])

const uuidField = z.string().uuid()
const schemaVersion1 = z.literal(1).default(1)

// TipTap JSON is the canonical content format (roadmap §10.4). Only the
// document envelope is validated here — deep per-node-type validation of
// arbitrary TipTap content isn't warranted for v1.
//
// Wiki-links (Milestone 4) are represented inline as
// `{ type: 'entityMention', attrs: { entityId: string, label: string } }`
// nodes, extracted server-side by `WikiLinksService` — not validated here
// for the same reason.
export const tiptapDocSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.unknown()) })
  .passthrough()
export type TiptapDoc = z.infer<typeof tiptapDocSchema>

const characterMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  aliases: z.array(z.string().trim().min(1)).optional(),
  pronouns: z.string().trim().max(100).optional(),
  species: z.string().trim().max(100).optional(),
  occupation: z.string().trim().max(150).optional(),
  lifeStatus: z.enum(['alive', 'deceased', 'unknown', 'undead']).optional(),
  currentLocationEntityId: uuidField.optional(),
})

const locationMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  locationType: z.string().trim().max(100).optional(),
  parentLocationEntityId: uuidField.optional(),
  population: z.number().int().nonnegative().optional(),
  government: z.string().trim().max(150).optional(),
})

const factionMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  aliases: z.array(z.string().trim().min(1)).optional(),
  factionType: z.string().trim().max(100).optional(),
  leaderEntityId: uuidField.optional(),
  headquartersLocationEntityId: uuidField.optional(),
})

const organizationMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  aliases: z.array(z.string().trim().min(1)).optional(),
  organizationType: z.string().trim().max(100).optional(),
  leaderEntityId: uuidField.optional(),
  headquartersLocationEntityId: uuidField.optional(),
})

const itemMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  itemType: z.string().trim().max(100).optional(),
  rarity: z.string().trim().max(50).optional(),
  currentOwnerEntityId: uuidField.optional(),
  currentLocationEntityId: uuidField.optional(),
})

const deityMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  aliases: z.array(z.string().trim().min(1)).optional(),
  domains: z.array(z.string().trim().min(1)).optional(),
  alignment: z.string().trim().max(50).optional(),
  symbol: z.string().trim().max(150).optional(),
})

const creatureMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  aliases: z.array(z.string().trim().min(1)).optional(),
  creatureType: z.string().trim().max(100).optional(),
  habitat: z.string().trim().max(150).optional(),
  threatLevel: z.string().trim().max(50).optional(),
})

const eventMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  eventType: z.string().trim().max(100).optional(),
  worldDateJson: z.record(z.string(), z.unknown()).optional(),
  locationEntityId: uuidField.optional(),
})

const questMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  questType: z.string().trim().max(100).optional(),
  questStatus: z.enum(['active', 'completed', 'failed']).optional(),
  questGiverEntityId: uuidField.optional(),
})

const loreMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  loreCategory: z.string().trim().max(100).optional(),
})

const customMetadataSchema = z.object({
  schemaVersion: schemaVersion1,
  fields: z.record(z.string(), z.unknown()).optional(),
})

const baseEntityFields = {
  name: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  visibility: entityVisibilitySchema.optional(),
  status: entityStatusSchema.optional(),
  publicContentJson: tiptapDocSchema.optional(),
  gmContentJson: tiptapDocSchema.nullable().optional(),
}

/**
 * `entityType` is the discriminant on the payload itself, not just the
 * stored row — the client always states which type it means, for both
 * create and update, so the correct per-type metadata schema can be picked
 * without a database round trip inside the validation pipe. The service
 * rejects an update whose `entityType` doesn't match the existing row
 * (entity type is immutable after creation).
 */
export const createEntitySchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('character'),
    ...baseEntityFields,
    metadata: characterMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('location'),
    ...baseEntityFields,
    metadata: locationMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('faction'),
    ...baseEntityFields,
    metadata: factionMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('organization'),
    ...baseEntityFields,
    metadata: organizationMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('item'),
    ...baseEntityFields,
    metadata: itemMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('deity'),
    ...baseEntityFields,
    metadata: deityMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('creature'),
    ...baseEntityFields,
    metadata: creatureMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('event'),
    ...baseEntityFields,
    metadata: eventMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('quest'),
    ...baseEntityFields,
    metadata: questMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('lore'),
    ...baseEntityFields,
    metadata: loreMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('custom'),
    ...baseEntityFields,
    metadata: customMetadataSchema.optional(),
  }),
])
export type CreateEntityInput = z.infer<typeof createEntitySchema>

const updateBaseEntityFields = {
  ...baseEntityFields,
  name: baseEntityFields.name.optional(),
  // Required: the client's last-known version, for optimistic concurrency
  // (roadmap §15.2) — a mismatch against the stored row means someone else
  // changed it first.
  updatedAt: z.string().datetime(),
}

export const updateEntitySchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('character'),
    ...updateBaseEntityFields,
    metadata: characterMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('location'),
    ...updateBaseEntityFields,
    metadata: locationMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('faction'),
    ...updateBaseEntityFields,
    metadata: factionMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('organization'),
    ...updateBaseEntityFields,
    metadata: organizationMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('item'),
    ...updateBaseEntityFields,
    metadata: itemMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('deity'),
    ...updateBaseEntityFields,
    metadata: deityMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('creature'),
    ...updateBaseEntityFields,
    metadata: creatureMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('event'),
    ...updateBaseEntityFields,
    metadata: eventMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('quest'),
    ...updateBaseEntityFields,
    metadata: questMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('lore'),
    ...updateBaseEntityFields,
    metadata: loreMetadataSchema.optional(),
  }),
  z.object({
    entityType: z.literal('custom'),
    ...updateBaseEntityFields,
    metadata: customMetadataSchema.optional(),
  }),
])
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>

export const listEntitiesQuerySchema = z.object({
  entityType: entityTypeSchema.optional(),
  tag: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
})
export type ListEntitiesQuery = z.infer<typeof listEntitiesQuerySchema>
