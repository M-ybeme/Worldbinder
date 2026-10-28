import { describe, expect, it } from 'vitest'
import { readFacts, readReferences } from './entityFacts'

describe('readFacts', () => {
  it('reads location facts in order and formats numbers', () => {
    expect(
      readFacts('location', {
        schemaVersion: 1,
        government: 'Ducal holding',
        population: 2400,
        locationType: 'Frontier town',
      }),
    ).toEqual([
      { label: 'Location type', value: 'Frontier town' },
      { label: 'Population', value: (2400).toLocaleString() },
      { label: 'Government', value: 'Ducal holding' },
    ])
  })

  it('capitalizes enum values and skips empty or missing fields', () => {
    expect(
      readFacts('character', { schemaVersion: 1, species: '  ', lifeStatus: 'deceased', pronouns: 'he/him' }),
    ).toEqual([
      { label: 'Pronouns', value: 'he/him' },
      { label: 'Life status', value: 'Deceased' },
    ])
  })

  it('joins list facts and drops empty lists', () => {
    expect(readFacts('deity', { domains: ['Storm', 'War'] })).toEqual([
      { label: 'Domains', value: 'Storm, War' },
    ])
    expect(readFacts('deity', { domains: [] })).toEqual([])
  })

  it('shows a custom entity’s own primitive fields', () => {
    expect(
      readFacts('custom', { fields: { Motto: 'Hold the wall', Founded: 1104, Secret: true, Nested: { a: 1 } } }),
    ).toEqual([
      { label: 'Motto', value: 'Hold the wall' },
      { label: 'Founded', value: (1104).toLocaleString() },
      { label: 'Secret', value: 'Yes' },
    ])
  })

  it('returns nothing without metadata, and ignores reference fields', () => {
    expect(readFacts('faction', null)).toEqual([])
    expect(readFacts('faction', { leaderEntityId: 'e1' })).toEqual([])
  })
})

describe('readReferences', () => {
  it('reads each type’s entity references with fact and connection labels', () => {
    expect(readReferences('location', { parentLocationEntityId: 'p1' })).toEqual([
      expect.objectContaining({ entityId: 'p1', factLabel: 'Parent location', connectionLabel: 'Located in' }),
    ])
    expect(readReferences('character', { currentLocationEntityId: 'l1' })).toEqual([
      expect.objectContaining({ entityId: 'l1', factLabel: 'Current location', connectionLabel: 'Currently in' }),
    ])
    expect(
      readReferences('faction', { leaderEntityId: 'c1', headquartersLocationEntityId: 'l1' }).map(
        (reference) => reference.connectionLabel,
      ),
    ).toEqual(['Led by', 'Based in'])
  })

  it('skips unset references and types without any', () => {
    expect(readReferences('location', { parentLocationEntityId: '' })).toEqual([])
    expect(readReferences('lore', { loreCategory: 'Myth' })).toEqual([])
    expect(readReferences('character', null)).toEqual([])
  })
})
