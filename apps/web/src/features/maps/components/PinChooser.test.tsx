import type { MapPinSummary } from '@worldbinder/contracts'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PinChooser } from './PinChooser'

function makePin(id: string, label: string, visibility: MapPinSummary['visibility'] = 'public'): MapPinSummary {
  return {
    id,
    mapId: 'map-1',
    layerId: null,
    locationEntityId: null,
    locationEntityName: null,
    locationEntityType: null,
    locationEntitySummary: null,
    label,
    xNormalized: 0.5,
    yNormalized: 0.5,
    visibility,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const pins = [makePin('a', 'Ashford'), makePin('b', 'Brightwater', 'gm_only'), makePin('c', 'Cinder Hollow')]

describe('PinChooser', () => {
  it('lists the pins, focusing the first', () => {
    render(<PinChooser pins={pins} onChoose={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: '3 pins here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ashford/ })).toHaveFocus()
    expect(screen.getByText('GM only')).toBeInTheDocument()
  })

  it('moves with the arrow keys, Home and End, wrapping around', () => {
    render(<PinChooser pins={pins} onChoose={() => {}} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: /^Brightwater/ })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'End' })
    expect(screen.getByRole('button', { name: /^Cinder Hollow/ })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: /^Ashford/ })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: /^Cinder Hollow/ })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Home' })
    expect(screen.getByRole('button', { name: /^Ashford/ })).toHaveFocus()
  })

  it('chooses on click, and closes on Escape or a press outside', () => {
    const onChoose = vi.fn()
    const onClose = vi.fn()
    render(
      <>
        <button type="button">elsewhere</button>
        <PinChooser pins={pins} onChoose={onChoose} onClose={onClose} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Cinder Hollow/ }))
    expect(onChoose).toHaveBeenCalledWith(pins[2])
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('can leave visibility out (At the Table)', () => {
    render(<PinChooser pins={pins} showVisibility={false} onChoose={() => {}} onClose={() => {}} />)
    expect(screen.queryByText('GM only')).not.toBeInTheDocument()
  })
})
