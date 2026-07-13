import type { MapPinSummary } from '@worldbinder/contracts'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface MapPinMarkerProps {
  pin: MapPinSummary
  x: number
  y: number
  manageMode: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) => void
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
}: MapPinMarkerProps) {
  const label = pin.label ?? pin.locationEntityName ?? 'Unlabeled pin'

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
    >
      <span aria-hidden="true">●</span>
    </button>
  )
}
