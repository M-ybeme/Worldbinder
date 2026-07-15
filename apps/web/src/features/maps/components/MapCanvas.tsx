import type { MapPinSummary } from '@worldbinder/contracts'
import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { MapPinMarker } from './MapPinMarker'

export interface MapCanvasProps {
  imageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  pins: MapPinSummary[]
  manageMode: boolean
  /** Fired for a plain click (not a drag) on a pin — the parent decides
   * what that means (navigate to the linked entity in view mode, open the
   * inline edit form in manage mode). */
  onPinActivate: (pin: MapPinSummary) => void
  /** Manage mode only — a click on empty canvas, pre-filled with the
   * clicked normalized position, to place a new pin. */
  onCanvasPlace?: (x: number, y: number) => void
  /** Manage mode only — fired once a drag ends with a real position change. */
  onPinReposition?: (pinId: string, x: number, y: number) => void
}

// A pointer that moved less than this is treated as a click, not a drag —
// distinguishes "select this pin" from "reposition this pin".
const DRAG_THRESHOLD_PX = 4

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function MapCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  pins,
  manageMode,
  onPinActivate,
  onCanvasPlace,
  onPinReposition,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ pinId: string; clientX: number; clientY: number } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ pinId: string; x: number; y: number } | null>(
    null,
  )

  if (!imageUrl) {
    return (
      <div className="wb-map-canvas wb-map-canvas--empty">
        <p>{manageMode ? 'Upload a map image to start placing pins.' : 'No map image yet.'}</p>
      </div>
    )
  }

  function positionFromEvent(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) {
    event.stopPropagation()
    dragStart.current = { pinId: pin.id, clientX: event.clientX, clientY: event.clientY }
    // Capture only in manage mode — a drag needs move/up events to keep
    // arriving even once the pointer leaves the button's bounds; a plain
    // view-mode click works fine without it.
    if (manageMode) event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) {
    if (!manageMode || dragStart.current?.pinId !== pin.id) return
    const position = positionFromEvent(event.clientX, event.clientY)
    if (position) setDragPosition({ pinId: pin.id, ...position })
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>, pin: MapPinSummary) {
    const start = dragStart.current
    dragStart.current = null
    setDragPosition(null)

    if (start?.pinId !== pin.id) {
      onPinActivate(pin)
      return
    }

    const moved =
      Math.abs(event.clientX - start.clientX) > DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - start.clientY) > DRAG_THRESHOLD_PX
    if (!manageMode || !moved) {
      onPinActivate(pin)
      return
    }

    const position = positionFromEvent(event.clientX, event.clientY)
    if (position) onPinReposition?.(pin.id, position.x, position.y)
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!manageMode || !onCanvasPlace) return
    if (event.target !== event.currentTarget) return // a pin, not the background
    const position = positionFromEvent(event.clientX, event.clientY)
    if (position) onCanvasPlace(position.x, position.y)
  }

  return (
    <div
      ref={containerRef}
      className="wb-map-canvas"
      style={
        imageWidth && imageHeight ? { aspectRatio: `${imageWidth} / ${imageHeight}` } : undefined
      }
      onClick={handleCanvasClick}
    >
      <img src={imageUrl} alt="" className="wb-map-canvas__image" draggable={false} />
      {pins.map((pin) => {
        const position =
          dragPosition?.pinId === pin.id ? dragPosition : { x: pin.xNormalized, y: pin.yNormalized }
        return (
          <MapPinMarker
            key={pin.id}
            pin={pin}
            x={position.x}
            y={position.y}
            manageMode={manageMode}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onActivate={onPinActivate}
          />
        )
      })}
    </div>
  )
}
