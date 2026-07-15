import type { MapPinSummary } from '@worldbinder/contracts'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

export interface MapPinMarkerProps {
  pin: MapPinSummary
  x: number
  y: number
  manageMode: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  /** Keyboard equivalent of a pointer click — a native button dispatches a
   * `click` event on Enter/Space, not the pointer events above, so without
   * this a keyboard-focused pin silently does nothing. */
  onActivate: (pin: MapPinSummary) => void
}

/** Purely presentational — positioning math and drag-vs-click detection
 * live in MapCanvas, which owns the container's bounding rect. */
export function MapPinMarker({
  pin,
  x,
  y,
  manageMode,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onActivate,
}: MapPinMarkerProps) {
  const label = pin.label ?? pin.locationEntityName ?? 'Unlabeled pin'

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(pin)
    }
  }

  return (
    <button
      type="button"
      className="wb-map-pin"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      title={label}
      aria-label={label}
      data-visibility={pin.visibility}
      data-manage-mode={manageMode || undefined}
      onPointerDown={(event) => onPointerDown(event, pin)}
      onPointerMove={(event) => onPointerMove(event, pin)}
      onPointerUp={(event) => onPointerUp(event, pin)}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true">●</span>
    </button>
  )
}
