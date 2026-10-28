import type { EntityDetail, EntityRelationshipView } from '@worldbinder/contracts'
import { describe, expect, it } from 'vitest'
import { readReferences } from './entityFacts'
import { mergeConnections } from './mergeConnections'

const target = (id: string, name: string) => ({ id, name, visibility: 'public' }) as EntityDetail

function rel(id: string, label: string, otherId: string, extra: Partial<EntityRelationshipView> = {}) {
  return {
    relationshipId: id,
    direction: 'outgoing',
    label,
    otherEntity: { id: otherId, name: otherId },
    description: null,
    visibility: 'public',
    ...extra,
  } as EntityRelationshipView
}

const parentOfBlackwall = readReferences('location', { parentLocationEntityId: 'march' }).map((r) => ({
  ...r,
  target: target('march', 'Northern March'),
}))

describe('mergeConnections', () => {
  it('folds a relationship stating the same fact into the derived connection', () => {
    const result = mergeConnections(parentOfBlackwall, [
      rel('r1', 'Located in', 'march', { description: 'Since the treaty of 1102.' }),
      rel('r2', 'Controlled by', 'renald'),
    ])
    expect(result.derived).toHaveLength(1)
    expect(result.derived[0]!.relationship?.relationshipId).toBe('r1')
    // The description survives, on the merged entry.
    expect(result.derived[0]!.relationship?.description).toBe('Since the treaty of 1102.')
    expect(result.relationships.map((r) => r.relationshipId)).toEqual(['r2'])
  })

  it('keeps a relationship to the same entity that says something different', () => {
    const result = mergeConnections(parentOfBlackwall, [rel('r1', 'Controlled by', 'march')])
    expect(result.derived[0]!.relationship).toBeUndefined()
    expect(result.relationships).toHaveLength(1)
  })

  it('keeps a same-label relationship to a different entity', () => {
    const result = mergeConnections(parentOfBlackwall, [rel('r1', 'Located in', 'velis')])
    expect(result.derived[0]!.relationship).toBeUndefined()
    expect(result.relationships).toHaveLength(1)
  })

  it('never folds in a GM-only relationship — its visibility differs from the detail', () => {
    const result = mergeConnections(parentOfBlackwall, [rel('r1', 'Located in', 'march', { visibility: 'gm_only' })])
    expect(result.derived[0]!.relationship).toBeUndefined()
    expect(result.relationships.map((r) => r.visibility)).toEqual(['gm_only'])
  })

  it('folds a relationship into at most one derived connection', () => {
    const faction = readReferences('faction', { leaderEntityId: 'mara', headquartersLocationEntityId: 'keep' }).map(
      (r) => ({ ...r, target: target(r.entityId, r.entityId) }),
    )
    const result = mergeConnections(faction, [rel('r1', 'Led by', 'mara', { direction: 'incoming' }), rel('r2', 'Located in', 'keep')])
    expect(result.derived.map((d) => d.relationship?.relationshipId)).toEqual(['r1', 'r2'])
    expect(result.relationships).toEqual([])
  })

  it('matches a character’s current location with a "Located in" relationship', () => {
    const character = readReferences('character', { currentLocationEntityId: 'bw' }).map((r) => ({
      ...r,
      target: target('bw', 'Blackwall'),
    }))
    expect(mergeConnections(character, [rel('r1', 'Located in', 'bw')]).relationships).toEqual([])
  })

  it('has nothing to merge for a hidden relationship the API never sent', () => {
    // A player's view: the GM-only "Located in" isn't in the list at all.
    const result = mergeConnections(parentOfBlackwall, [])
    expect(result.derived[0]!.relationship).toBeUndefined()
  })
})
