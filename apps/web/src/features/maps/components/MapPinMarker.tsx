import type { MapPinSummary } from '@worldbinder/contracts'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { EntityTypeIcon } from '../../entities/lib/entityTypeIcons'
import { pinLabel } from '../lib/pins'

// Arrow-key nudge in edit mode, as a fraction of the map (Shift: bigger).
const NUDGE = 0.005
const NUDGE_LARGE = 0.02

export interface MapPinMarkerProps {
  pin: MapPinSummary
  x: number
  y: number
  manageMode: boolean
  selected?: boolean
  /** Draw the name beside the marker (when there's room for it). */
  showLabel?: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  /** Keyboard equivalent of a pointer click — a native button dispatches a
   * `click` event on Enter/Space, not the pointer events above, so without
   * this a keyboard-focused pin silently does nothing. */
  onActivate: (pin: MapPinSummary) => void
  /** Edit mode: arrow keys move the pin (the keyboard's drag). */
  onNudge?: (pin: MapPinSummary, dx: number, dy: number) => void
}

/** Purely presentational — positioning math and drag-vs-click detection
 * live in MapCanvas, which owns the container's bounding rect. */
export function MapPinMarker({
  pin,
  x,
  y,
  manageMode,
  selected = false,
  showLabel = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onActivate,
  onNudge,
}: MapPinMarkerProps) {
  const label = pinLabel(pin)
  const gmOnly = pin.visibility === 'gm_only'

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(pin)
      return
    }
    if (!manageMode || !onNudge) return
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    event.stopPropagation()
    onNudge(pin, move[0], move[1])
  }

  return (
    <button
      type="button"
      className="wb-map-pin"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      title={showLabel ? undefined : label}
      aria-label={gmOnly ? `${label} (GM only)` : label}
      aria-pressed={selected}
      data-visibility={pin.visibility}
      data-manage-mode={manageMode || undefined}
      data-selected={selected || undefined}
      data-labelled={showLabel || undefined}
      onPointerDown={(event) => onPointerDown(event, pin)}
      onPointerMove={(event) => onPointerMove(event, pin)}
      onPointerUp={(event) => onPointerUp(event, pin)}
      onKeyDown={handleKeyDown}
    >
      <span className="wb-map-pin__dot" aria-hidden="true">
        {pin.locationEntityType ? <EntityTypeIcon type={pin.locationEntityType} size={11} /> : null}
      </span>
      {showLabel ? (
        <span className="wb-map-pin__label" aria-hidden="true">
          {label}
        </span>
      ) : (
        <span className="wb-map-pin__tooltip" aria-hidden="true">
          {label}
        </span>
      )}
    </button>
  )
}

/** Several pins too close to tell apart at this zoom: one marker with a
 * count, which opens a chooser (never picks one of them at random). */
export function MapClusterMarker({
  pins,
  x,
  y,
  onActivate,
}: {
  pins: MapPinSummary[]
  x: number
  y: number
  onActivate: (pins: MapPinSummary[], element: HTMLElement) => void
}) {
  const names = pins.map(pinLabel)
  return (
    <button
      type="button"
      className="wb-map-cluster"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      aria-label={`${pins.length} pins here: ${names.join(', ')}`}
      aria-haspopup="dialog"
      // A cluster only selects; it's never dragged, so the map's own pan
      // handling must not treat a press on it as a drag start.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => onActivate(pins, event.currentTarget)}
    >
      {pins.length}
    </button>
  )
}
