import type { MapPinSummary } from '@worldbinder/contracts'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapPinMarker } from './MapPinMarker'

const pin: MapPinSummary = {
  id: 'pin-1',
  mapId: 'map-1',
  layerId: null,
  locationEntityId: null,
  locationEntityName: null,
  locationEntityType: null,
  label: 'Watchtower',
  xNormalized: 0.5,
  yNormalized: 0.5,
  visibility: 'public',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderMarker(onActivate: (pin: MapPinSummary) => void) {
  return render(
    <MapPinMarker
      pin={pin}
      x={0.5}
      y={0.5}
      manageMode={false}
      onPointerDown={() => {}}
      onPointerMove={() => {}}
      onPointerUp={() => {}}
      onActivate={onActivate}
    />,
  )
}

describe('MapPinMarker', () => {
  it('is a real, labeled button', () => {
    renderMarker(() => {})
    expect(screen.getByRole('button', { name: 'Watchtower' })).toBeInTheDocument()
  })

  it('activates on Enter — regression test for the keyboard-activation bug (Milestone 13 Phase 2)', () => {
    const onActivate = vi.fn()
    renderMarker(onActivate)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Watchtower' }), { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(pin)
  })

  it('activates on Space', () => {
    const onActivate = vi.fn()
    renderMarker(onActivate)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Watchtower' }), { key: ' ' })
    expect(onActivate).toHaveBeenCalledWith(pin)
  })

  it('does not activate on unrelated keys', () => {
    const onActivate = vi.fn()
    renderMarker(onActivate)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Watchtower' }), { key: 'Tab' })
    expect(onActivate).not.toHaveBeenCalled()
  })
})
