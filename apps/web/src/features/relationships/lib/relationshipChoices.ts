import type { EntityRelationshipView, EntityType, RelationshipType } from '@worldbinder/contracts'
import { readReferences } from '../../entities/lib/entityFacts'

/**
 * Relationships are stored once, source → type → target; the API shows a
 * row from the target's side with the type's reverse label ("Located in"
 * seen from the other end is "Contains"). Adding one from either end is the
 * same create call with source and target swapped — no other relationship
 * is invented. These helpers build those choices and check a candidate
 * against what already exists.
 */

/** `subject`: this entity is the source (forward label). `object`: it's the
 * target (reverse label). */
export type RelationshipRole = 'subject' | 'object'

export interface RelationshipChoice {
  /** Stable select value: `${typeId}:${role}`. */
  value: string
  type: RelationshipType
  role: RelationshipRole
  /** As read from this entity: "Blackwall … Contains … X". */
  label: string
}

const allows = (list: EntityType[] | null, entityType: EntityType) =>
  list === null || list.includes(entityType)

/** Every way this entity can take part in each type, given the types'
 * allowed source/target lists. A symmetric type is offered once. */
export function relationshipChoices(
  types: RelationshipType[],
  entityType: EntityType,
): { subject: RelationshipChoice[]; object: RelationshipChoice[] } {
  const byLabel = (a: RelationshipChoice, b: RelationshipChoice) => a.label.localeCompare(b.label)
  const subject = types
    .filter((type) => allows(type.allowedSourceTypes, entityType))
    .map((type) => ({
      value: `${type.id}:subject`,
      type,
      role: 'subject' as const,
      label: type.forwardLabel,
    }))
    .sort(byLabel)
  const object = types
    .filter((type) => !type.symmetric && allows(type.allowedTargetTypes, entityType))
    .map((type) => ({
      value: `${type.id}:object`,
      type,
      role: 'object' as const,
      label: type.reverseLabel,
    }))
    .sort(byLabel)
  return { subject, object }
}

/** The entity types allowed at the other end, or null for any. */
export function allowedOtherTypes(choice: RelationshipChoice): EntityType[] | null {
  return choice.role === 'subject' ? choice.type.allowedTargetTypes : choice.type.allowedSourceTypes
}

export function endpoints(
  choice: RelationshipChoice,
  thisEntityId: string,
  otherEntityId: string,
): { sourceEntityId: string; targetEntityId: string } {
  return choice.role === 'subject'
    ? { sourceEntityId: thisEntityId, targetEntityId: otherEntityId }
    : { sourceEntityId: otherEntityId, targetEntityId: thisEntityId }
}

/** An existing relationship (among those this member can see) that states
 * the same fact, including the same relationship added from the other end.
 * Types that allow duplicates never match. The API enforces the same rule
 * (409), which also covers relationships hidden from this member. */
export function findDuplicate(
  choice: RelationshipChoice,
  thisEntityId: string,
  otherEntityId: string,
  existing: EntityRelationshipView[],
): EntityRelationshipView | undefined {
  if (choice.type.allowDuplicates) return undefined
  const wanted = endpoints(choice, thisEntityId, otherEntityId)
  return existing.find((view) => {
    if (view.relationshipTypeId !== choice.type.id || view.otherEntity.id !== otherEntityId) {
      return false
    }
    const actual =
      view.direction === 'outgoing'
        ? { sourceEntityId: thisEntityId, targetEntityId: otherEntityId }
        : { sourceEntityId: otherEntityId, targetEntityId: thisEntityId }
    return (
      choice.type.symmetric ||
      (actual.sourceEntityId === wanted.sourceEntityId &&
        actual.targetEntityId === wanted.targetEntityId)
    )
  })
}

export interface MetadataOverlap {
  /** Whose field already states it. */
  owner: 'this' | 'other'
  /** The field's label, e.g. "Parent location". */
  fieldLabel: string
}

interface EntityWithMetadata {
  id: string
  entityType: EntityType
  metadataJson: Record<string, unknown> | null
}

/** A metadata field — on either entity — that already states this
 * relationship (a location's Parent location, a character's Current
 * location, a faction's Leader or Headquarters…). Those fields are the
 * authoritative place for the fact, so the relationship would be redundant;
 * the field is edited on the Details tab. */
export function findMetadataOverlap(
  choice: RelationshipChoice,
  thisEntity: EntityWithMetadata,
  other: EntityWithMetadata,
): MetadataOverlap | undefined {
  const ownField = readReferences(thisEntity.entityType, thisEntity.metadataJson).find(
    (reference) =>
      reference.entityId === other.id && reference.sameFactLabels.includes(choice.label),
  )
  if (ownField) return { owner: 'this', fieldLabel: ownField.factLabel }

  // The same relationship as read from the other entity.
  const otherLabel = choice.role === 'subject' ? choice.type.reverseLabel : choice.type.forwardLabel
  const otherField = readReferences(other.entityType, other.metadataJson).find(
    (reference) =>
      reference.entityId === thisEntity.id && reference.sameFactLabels.includes(otherLabel),
  )
  if (otherField) return { owner: 'other', fieldLabel: otherField.factLabel }
  return undefined
}
