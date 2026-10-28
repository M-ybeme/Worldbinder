import type { EntityDetail, EntityRelationshipView } from '@worldbinder/contracts'
import type { EntityReference } from './entityFacts'

export interface DerivedConnection extends EntityReference {
  target: EntityDetail
  /** An explicit relationship stating the same fact, folded into this
   * entry so it's listed once — its description stays visible here. */
  relationship?: EntityRelationshipView
}

/**
 * Pairs each metadata-derived connection with an explicit relationship that
 * states the same fact — same other entity, and a label listed in the
 * reference's `sameFactLabels` (e.g. a location's Parent location and a
 * "Located in" relationship to that same place) — so it isn't shown twice.
 *
 * Presentation only: nothing is changed or deleted. Only relationships the
 * API returned (already filtered to what this member may see) take part,
 * so merging can't reveal anything. A GM-only relationship is never folded
 * into a derived connection: their visibility differs, so both stay listed
 * and the GM-only badge stays on the relationship.
 */
export function mergeConnections(
  derived: (EntityReference & { target: EntityDetail })[],
  relationships: EntityRelationshipView[],
): { derived: DerivedConnection[]; relationships: EntityRelationshipView[] } {
  const used = new Set<string>()
  const merged = derived.map((item): DerivedConnection => {
    const match = relationships.find(
      (rel) =>
        !used.has(rel.relationshipId) &&
        rel.visibility === 'public' &&
        rel.otherEntity.id === item.target.id &&
        item.sameFactLabels.includes(rel.label),
    )
    if (!match) return item
    used.add(match.relationshipId)
    return { ...item, relationship: match }
  })
  return {
    derived: merged,
    relationships: relationships.filter((rel) => !used.has(rel.relationshipId)),
  }
}
