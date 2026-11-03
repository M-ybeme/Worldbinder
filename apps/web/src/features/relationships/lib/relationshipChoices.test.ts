import type { EntityRelationshipView, EntityType, RelationshipType } from '@worldbinder/contracts'
import { describe, expect, it } from 'vitest'
import {
  allowedOtherTypes,
  endpoints,
  findDuplicate,
  findMetadataOverlap,
  relationshipChoices,
  type RelationshipChoice,
} from './relationshipChoices'

function type(
  id: string,
  forwardLabel: string,
  reverseLabel: string,
  extra: Partial<RelationshipType> = {},
): RelationshipType {
  return {
    id,
    campaignId: null,
    key: id,
    forwardLabel,
    reverseLabel,
    allowedSourceTypes: null,
    allowedTargetTypes: null,
    symmetric: false,
    allowDuplicates: false,
    defaultVisibility: 'public',
    ...extra,
  }
}

// The built-in types these rules matter for (same labels and allowed types).
const allyOf = type('ally', 'Ally of', 'Ally of', { symmetric: true })
const locatedIn = type('located', 'Located in', 'Contains', { allowedTargetTypes: ['location'] })
const leaderOf = type('leader', 'Leader of', 'Led by', {
  allowedTargetTypes: ['faction', 'organization'],
})
const owns = type('owns', 'Owns', 'Owned by')
const TYPES = [allyOf, locatedIn, leaderOf, owns]

function choice(entityType: EntityType, label: string): RelationshipChoice {
  const { subject, object } = relationshipChoices(TYPES, entityType)
  const found = [...subject, ...object].find((item) => item.label === label)
  if (!found) throw new Error(`no "${label}" for ${entityType}`)
  return found
}

function view(
  typeId: string,
  direction: 'outgoing' | 'incoming',
  otherId: string,
  label: string,
): EntityRelationshipView {
  return {
    relationshipId: `${typeId}-${direction}-${otherId}`,
    relationshipTypeId: typeId,
    direction,
    label,
    otherEntity: { id: otherId, name: otherId } as EntityRelationshipView['otherEntity'],
    description: null,
    visibility: 'public',
  }
}

describe('relationshipChoices', () => {
  it('offers reverse labels only where the type allows this entity as the target', () => {
    const location = relationshipChoices(TYPES, 'location')
    expect(location.object.map((item) => item.label)).toEqual(['Contains', 'Owned by'])
    const character = relationshipChoices(TYPES, 'character')
    // A character can't be the target of "Located in", so no "Contains".
    expect(character.object.map((item) => item.label)).toEqual(['Owned by'])
    expect(character.subject.map((item) => item.label)).toEqual([
      'Ally of',
      'Leader of',
      'Located in',
      'Owns',
    ])
  })

  it('offers a symmetric type once', () => {
    const { subject, object } = relationshipChoices(TYPES, 'character')
    expect([...subject, ...object].filter((item) => item.type.id === 'ally')).toHaveLength(1)
  })

  it('swaps source and target for a reverse choice, keeping the stored semantics', () => {
    expect(endpoints(choice('location', 'Contains'), 'blackwall', 'inn')).toEqual({
      sourceEntityId: 'inn',
      targetEntityId: 'blackwall',
    })
    expect(endpoints(choice('location', 'Located in'), 'blackwall', 'march')).toEqual({
      sourceEntityId: 'blackwall',
      targetEntityId: 'march',
    })
    expect(allowedOtherTypes(choice('location', 'Contains'))).toBeNull()
    expect(allowedOtherTypes(choice('character', 'Located in'))).toEqual(['location'])
  })
})

describe('findDuplicate', () => {
  it('catches the same relationship added from the other end', () => {
    // Stored: Inn — Located in → Blackwall, seen from Blackwall as incoming "Contains".
    const existing = [view('located', 'incoming', 'inn', 'Contains')]
    expect(findDuplicate(choice('location', 'Contains'), 'blackwall', 'inn', existing)).toBe(
      existing[0],
    )
    // The opposite fact (Blackwall located in the Inn) is a different relationship.
    expect(
      findDuplicate(choice('location', 'Located in'), 'blackwall', 'inn', existing),
    ).toBeUndefined()
  })

  it('treats either ordering of a symmetric type as the same', () => {
    const existing = [view('ally', 'incoming', 'ilsabet', 'Ally of')]
    expect(findDuplicate(choice('character', 'Ally of'), 'mara', 'ilsabet', existing)).toBe(
      existing[0],
    )
  })

  it('ignores other entities, other types, and types that allow duplicates', () => {
    const existing = [view('owns', 'outgoing', 'sword', 'Owns')]
    expect(findDuplicate(choice('character', 'Owns'), 'mara', 'shield', existing)).toBeUndefined()
    expect(findDuplicate(choice('character', 'Ally of'), 'mara', 'sword', existing)).toBeUndefined()
    const repeatable = { ...choice('character', 'Owns'), type: { ...owns, allowDuplicates: true } }
    expect(findDuplicate(repeatable, 'mara', 'sword', existing)).toBeUndefined()
  })
})

describe('findMetadataOverlap', () => {
  const blackwall = {
    id: 'blackwall',
    entityType: 'location' as const,
    metadataJson: { parentLocationEntityId: 'march' },
  }
  const march = { id: 'march', entityType: 'location' as const, metadataJson: null }

  it('finds this entity’s own field (a location’s Parent location)', () => {
    expect(findMetadataOverlap(choice('location', 'Located in'), blackwall, march)).toEqual({
      owner: 'this',
      fieldLabel: 'Parent location',
    })
  })

  it('finds the other entity’s field when adding from the other end', () => {
    // On the March: "Contains Blackwall" — Blackwall's Parent location says so.
    expect(findMetadataOverlap(choice('location', 'Contains'), march, blackwall)).toEqual({
      owner: 'other',
      fieldLabel: 'Parent location',
    })
  })

  it('covers a character’s Current location and a faction’s Leader', () => {
    const mara = {
      id: 'mara',
      entityType: 'character' as const,
      metadataJson: { currentLocationEntityId: 'blackwall' },
    }
    expect(findMetadataOverlap(choice('character', 'Located in'), mara, blackwall)).toEqual({
      owner: 'this',
      fieldLabel: 'Current location',
    })

    const guard = {
      id: 'guard',
      entityType: 'faction' as const,
      metadataJson: { leaderEntityId: 'mara' },
    }
    // From Mara: "Leader of the Ashen Guard" is the Guard's Leader field.
    expect(findMetadataOverlap(choice('character', 'Leader of'), mara, guard)).toEqual({
      owner: 'other',
      fieldLabel: 'Leader',
    })
    expect(findMetadataOverlap(choice('faction', 'Owned by'), guard, mara)).toBeUndefined()
  })
})
