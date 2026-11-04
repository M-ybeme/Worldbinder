import type { MapPinSummary } from '@worldbinder/contracts'
import { describe, expect, it } from 'vitest'
import { groupOverlapping, matchesFilter, NO_FILTER, pinsWithRoomForLabels, type ScreenPin } from './pins'

function makePin(id: string, overrides: Partial<MapPinSummary> = {}): MapPinSummary {
  return {
    id,
    mapId: 'map-1',
    layerId: null,
    locationEntityId: null,
    locationEntityName: null,
    locationEntityType: null,
    locationEntitySummary: null,
    label: id,
    xNormalized: 0.5,
    yNormalized: 0.5,
    visibility: 'public',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const at = (pin: MapPinSummary, x: number, y: number): ScreenPin => ({ pin, x, y })

describe('matchesFilter', () => {
  const keep = makePin('keep', {
    label: null,
    locationEntityId: 'e1',
    locationEntityName: 'Blackwall',
    locationEntityType: 'location',
    locationEntitySummary: 'Frontier town by the old keep.',
  })
  const secret = makePin('Secret door', { visibility: 'gm_only' })

  it('matches everything with no filter', () => {
    expect(matchesFilter(keep, NO_FILTER)).toBe(true)
    expect(matchesFilter(secret, NO_FILTER)).toBe(true)
  })

  it('searches the name, the entry summary and the layer name, ignoring case and spaces around', () => {
    expect(matchesFilter(keep, { ...NO_FILTER, query: ' blackWALL ' })).toBe(true)
    expect(matchesFilter(keep, { ...NO_FILTER, query: 'old keep' })).toBe(true)
    expect(matchesFilter(keep, { ...NO_FILTER, query: 'settle' }, 'Settlements')).toBe(true)
    expect(matchesFilter(keep, { ...NO_FILTER, query: 'harbour' }, 'Settlements')).toBe(false)
  })

  it('narrows by kind, with "none" meaning pins without an entry', () => {
    expect(matchesFilter(keep, { ...NO_FILTER, kinds: new Set(['location']) })).toBe(true)
    expect(matchesFilter(keep, { ...NO_FILTER, kinds: new Set(['character']) })).toBe(false)
    expect(matchesFilter(secret, { ...NO_FILTER, kinds: new Set(['none']) })).toBe(true)
  })

  it('narrows by visibility', () => {
    expect(matchesFilter(secret, { ...NO_FILTER, visibility: 'gm_only' })).toBe(true)
    expect(matchesFilter(keep, { ...NO_FILTER, visibility: 'gm_only' })).toBe(false)
    expect(matchesFilter(secret, { ...NO_FILTER, visibility: 'public' })).toBe(false)
  })
})

describe('groupOverlapping', () => {
  const a = makePin('a', { xNormalized: 0.1, yNormalized: 0.1 })
  const b = makePin('b', { xNormalized: 0.3, yNormalized: 0.1 })
  const c = makePin('c', { xNormalized: 0.9, yNormalized: 0.9 })

  it('groups pins within the radius and averages their position', () => {
    const groups = groupOverlapping([at(a, 100, 100), at(b, 110, 100), at(c, 400, 400)], 22)
    expect(groups.map((group) => group.pins.map((pin) => pin.id))).toEqual([['a', 'b'], ['c']])
    expect(groups[0]!.xNormalized).toBeCloseTo(0.2)
    expect(groups[0]!.key).toBe('a+b')
  })

  it('leaves pins apart when they are further than the radius', () => {
    expect(groupOverlapping([at(a, 100, 100), at(b, 123, 100)], 22)).toHaveLength(2)
  })

  it('never groups the selected pin, but still groups the rest', () => {
    const groups = groupOverlapping([at(a, 100, 100), at(b, 105, 100), at(c, 108, 100)], 22, 'a')
    expect(groups.map((group) => group.pins.map((pin) => pin.id))).toEqual([['a'], ['b', 'c']])
  })

  it('is deterministic: the same input gives the same groups', () => {
    const points = [at(a, 100, 100), at(b, 115, 100), at(c, 130, 100)]
    expect(groupOverlapping(points, 22)).toEqual(groupOverlapping(points, 22))
  })
})

describe('pinsWithRoomForLabels', () => {
  it('labels pins whose labels would not collide', () => {
    const labelled = pinsWithRoomForLabels([at(makePin('a'), 0, 0), at(makePin('b'), 0, 200)])
    expect([...labelled].sort()).toEqual(['a', 'b'])
  })

  it('leaves out a label that would cover another marker, even one with no label of its own', () => {
    const named = makePin('Watchtower 1')
    const group = { x: 40, y: 0 }
    expect([...pinsWithRoomForLabels([at(named, 0, 0)], null, [{ x: 0, y: 0 }, group])]).toEqual([])
    expect([...pinsWithRoomForLabels([at(named, 0, 0)], null, [{ x: 0, y: 0 }, { x: 40, y: 60 }])]).toEqual([
      'Watchtower 1',
    ])
  })

  it('gives the room to the selected pin, then to pins linked to entries', () => {
    const plain = makePin('plain')
    const linked = makePin('linked', { locationEntityId: 'e1' })
    const selected = makePin('selected')
    expect([...pinsWithRoomForLabels([at(plain, 0, 0), at(linked, 5, 0)])]).toEqual(['linked'])
    expect([...pinsWithRoomForLabels([at(plain, 0, 0), at(linked, 5, 0), at(selected, 10, 0)], 'selected')]).toEqual([
      'selected',
    ])
  })
})
