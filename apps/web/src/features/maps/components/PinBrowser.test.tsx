import type { MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NO_FILTER, type PinFilter } from '../lib/pins'
import { PinBrowser } from './PinBrowser'

function makePin(id: string, overrides: Partial<MapPinSummary>): MapPinSummary {
  return {
    id,
    mapId: 'map-1',
    layerId: null,
    locationEntityId: null,
    locationEntityName: null,
    locationEntityType: null,
    locationEntitySummary: null,
    label: null,
    xNormalized: 0.5,
    yNormalized: 0.5,
    visibility: 'public',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const layers: MapLayerSummary[] = [
  { id: 'towns', mapId: 'map-1', name: 'Settlements', visibility: 'public', displayOrder: 0 },
]
const pins = [
  makePin('1', {
    layerId: 'towns',
    locationEntityId: 'e1',
    locationEntityName: 'Blackwall',
    locationEntityType: 'location',
  }),
  makePin('2', {
    locationEntityId: 'e2',
    locationEntityName: 'Mara Voss',
    locationEntityType: 'character',
  }),
  makePin('3', { label: 'Secret door', visibility: 'gm_only' }),
]

function Harness({
  onSelect = () => {},
  items = pins,
}: {
  onSelect?: (pin: MapPinSummary) => void
  items?: MapPinSummary[]
}) {
  const [filter, setFilter] = useState<PinFilter>(NO_FILTER)
  return (
    <PinBrowser
      pins={items}
      layers={layers}
      hiddenLayerIds={new Set(['towns'])}
      showUnlayered
      filter={filter}
      onFilterChange={setFilter}
      selectedPinId="2"
      onSelect={onSelect}
    />
  )
}

describe('PinBrowser', () => {
  it('groups pins by layer, marks the selected one and hidden layers', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { level: 3, name: /Settlements/ })).toHaveTextContent(
      '(hidden on the map)',
    )
    expect(screen.getByRole('heading', { level: 3, name: 'No layer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mara Voss/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('searches, and says how many match', () => {
    render(<Harness />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a pin' }), {
      target: { value: 'mara' },
    })
    expect(screen.getByText(/Showing 1 of 3/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Blackwall/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a pin' }), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('No pins match.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: /^Blackwall/ })).toBeInTheDocument()
  })

  it('filters by kind and visibility with toggle chips', () => {
    render(<Harness />)
    const filters = screen.getByRole('group', { name: 'Filter pins' })
    fireEvent.click(within(filters).getByRole('button', { name: /^Character/ }))
    expect(within(filters).getByRole('button', { name: /^Character/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByRole('button', { name: /Blackwall|Mara Voss|Secret door/ })).toHaveLength(
      1,
    )
    fireEvent.click(within(filters).getByRole('button', { name: /^Character/ }))
    fireEvent.click(within(filters).getByRole('button', { name: 'GM only' }))
    expect(screen.getByRole('button', { name: /^Secret door/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Blackwall/ })).not.toBeInTheDocument()
  })

  it('offers no visibility filter when there are no GM-only pins (a player never sees one)', () => {
    render(<Harness items={pins.slice(0, 2)} />)
    expect(screen.queryByRole('button', { name: 'GM only' })).not.toBeInTheDocument()
    expect(screen.queryByText(/GM only/)).not.toBeInTheDocument()
  })

  it('selects a pin from its row', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /^Blackwall/ }))
    expect(onSelect).toHaveBeenCalledWith(pins[0])
  })
})
