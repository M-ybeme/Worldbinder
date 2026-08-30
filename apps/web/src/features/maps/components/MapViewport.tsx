import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import '../maps.css'
import { MapCanvas, type MapCanvasProps } from './MapCanvas'
import { MapToolbar } from './MapToolbar'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
// Same threshold MapCanvas uses to tell a pin click from a pin drag — here
// it tells a background click (place a pin) from a background drag (pan).
const PAN_THRESHOLD_PX = 4
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const BUTTON_ZOOM_STEP = 1.25

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

/** Keeps the content point under `anchor` fixed on screen while zooming
 * from `prevZoom`/`prevPan` to `nextZoom` — the standard "zoom to point"
 * transform, shared by wheel-zoom, pinch-zoom, and the toolbar buttons. */
function zoomToPoint(
  prevZoom: number,
  prevPan: { x: number; y: number },
  anchor: { x: number; y: number },
  nextZoom: number,
): { x: number; y: number } {
  const ratio = nextZoom / prevZoom
  return {
    x: anchor.x - (anchor.x - prevPan.x) * ratio,
    y: anchor.y - (anchor.y - prevPan.y) * ratio,
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export type MapViewportProps = MapCanvasProps

/** Wraps MapCanvas with a pannable/zoomable "work area": scroll/pinch to
 * zoom, drag the background to pan, plus toolbar buttons for the same. Pins
 * keep working unchanged — their own pointer handlers call
 * stopPropagation(), so they never reach this component's pan/pinch
 * handlers, and CSS transforms don't affect getBoundingClientRect(), so
 * MapCanvas's own click/drag position math stays correct at any zoom/pan. */
export function MapViewport(props: MapViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const downPosition = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const suppressNextClick = useRef(false)
  const lastPinchDistance = useRef<number | null>(null)

  function viewportPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }

  // Takes a function of the *previous* zoom rather than a plain number so
  // every call site (including the native wheel listener below, which
  // can't rely on a fresh `zoom` closure — see its own comment) composes
  // correctly against whatever zoom/pan state is current when it actually
  // runs, not whatever it was when the handler was created.
  function applyZoom(
    nextZoomFromPrev: (prevZoom: number) => number,
    anchor: { x: number; y: number },
  ) {
    setZoom((prevZoom) => {
      const nextZoom = clampZoom(nextZoomFromPrev(prevZoom))
      setPan((prevPan) => zoomToPoint(prevZoom, prevPan, anchor, nextZoom))
      return nextZoom
    })
  }

  // Not a React onWheel prop: React attaches its delegated wheel listener
  // as passive, so event.preventDefault() inside a synthetic onWheel
  // handler is silently ignored and the page scrolls underneath the map
  // regardless — a well-known React limitation. A real, non-passive
  // addEventListener is the only way to actually stop that scroll.
  useEffect(() => {
    const surface = viewportRef.current
    if (!surface || !props.imageUrl) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
      applyZoom((prevZoom) => prevZoom * factor, viewportPoint(event.clientX, event.clientY))
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [props.imageUrl])

  function handleZoomButton(direction: 1 | -1) {
    const rect = viewportRef.current?.getBoundingClientRect()
    const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
    applyZoom(
      (prevZoom) => (direction > 0 ? prevZoom * BUTTON_ZOOM_STEP : prevZoom / BUTTON_ZOOM_STEP),
      center,
    )
  }

  function handleReset() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!props.imageUrl) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    // Pointer capture is deferred to handlePointerMove, once a drag/pinch is
    // actually confirmed — NOT here. A captured pointer's eventual native
    // `click` event gets retargeted by the browser to the *capturing*
    // element (this surface), not the element under the cursor. Since
    // MapCanvas's click-to-place-a-pin handler lives on a descendant
    // (`.wb-map-canvas`, nested inside this surface), React's bubble
    // simulation — which walks up from the event's target — would never
    // reach it if every plain click captured the pointer up front.
    if (pointers.current.size === 1) {
      downPosition.current = { x: event.clientX, y: event.clientY }
      didDrag.current = false
    } else {
      lastPinchDistance.current = null
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    const previous = pointers.current.get(event.pointerId)!
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const active = Array.from(pointers.current.values())
    if (active.length === 2) {
      const [a, b] = active
      const currentDistance = distance(a, b)
      const currentMidpoint = viewportPoint(midpoint(a, b).x, midpoint(a, b).y)
      if (lastPinchDistance.current === null) {
        event.currentTarget.setPointerCapture(event.pointerId)
      } else {
        const distanceAtGestureStart = lastPinchDistance.current
        applyZoom(
          (prevZoom) => prevZoom * (currentDistance / distanceAtGestureStart),
          currentMidpoint,
        )
      }
      lastPinchDistance.current = currentDistance
      return
    }

    if (active.length !== 1 || !downPosition.current) return
    if (!didDrag.current) {
      const moved = distance(downPosition.current, { x: event.clientX, y: event.clientY })
      if (moved <= PAN_THRESHOLD_PX) return
      didDrag.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setPan((prev) => ({
      x: prev.x + (event.clientX - previous.x),
      y: prev.y + (event.clientY - previous.y),
    }))
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) lastPinchDistance.current = null
    if (pointers.current.size === 0) {
      if (didDrag.current) suppressNextClick.current = true
      didDrag.current = false
      downPosition.current = null
    }
  }

  // A drag-to-pan still ends with a native `click` on whatever element the
  // pointer landed on — without this, panning across the background would
  // also fire MapCanvas's click-to-place-a-pin handler in manage mode.
  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressNextClick.current) return
    suppressNextClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  if (!props.imageUrl) return <MapCanvas {...props} />

  const surfaceClassName = [
    'wb-map-viewport__surface',
    props.onCanvasPlace && 'wb-map-viewport__surface--placing',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="wb-map-viewport">
      <MapToolbar
        zoom={zoom}
        onZoomIn={() => handleZoomButton(1)}
        onZoomOut={() => handleZoomButton(-1)}
        onReset={handleReset}
      />
      <div
        ref={viewportRef}
        className={surfaceClassName}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        <div
          className="wb-map-viewport__stage"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <MapCanvas {...props} />
        </div>
      </div>
    </div>
  )
}
