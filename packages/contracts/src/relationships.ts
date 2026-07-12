import type { EntitySummary, EntityType, EntityVisibility } from './entities.js'

export interface RelationshipType {
  id: string
  campaignId: string | null
  key: string
  forwardLabel: string
  reverseLabel: string
  allowedSourceTypes: EntityType[] | null
  allowedTargetTypes: EntityType[] | null
  symmetric: boolean
  allowDuplicates: boolean
  defaultVisibility: EntityVisibility
}

export interface EntityRelationship {
  id: string
  campaignId: string
  sourceEntityId: string
  targetEntityId: string
  relationshipTypeId: string
  description: string | null
  visibility: EntityVisibility
  createdAt: string
  updatedAt: string
}

/** The neighborhood-query shape used by the entity detail page: one row per
 * relationship touching the entity, already projected to the correct label
 * and "other" entity for whichever direction it is. */
export interface EntityRelationshipView {
  relationshipId: string
  direction: 'outgoing' | 'incoming'
  label: string
  otherEntity: EntitySummary
  description: string | null
  visibility: EntityVisibility
}
