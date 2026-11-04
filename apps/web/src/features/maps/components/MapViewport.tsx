import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import '../maps.css'
import { groupOverlapping, pinsWithRoomForLabels } from '../lib/pins'
import { MapCanvas, type MapCanvasProps } from './MapCanvas'
import { MapToolbar } from './MapToolbar'

// Zoom is relative to "fit" (the whole map visible). Below fit is allowed a
// little; above, up to MAX_ZOOM or twice the image's own resolution,
// whichever is more, so very large maps can still be read in detail.
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
// Same threshold MapCanvas uses to tell a pin click from a pin drag — here
// it tells a background click from a background drag (pan).
const PAN_THRESHOLD_PX = 4
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const BUTTON_ZOOM_STEP = 1.25
const KEY_PAN_PX = 80
// Pins whose markers are closer than this on screen are grouped.
const CLUSTER_RADIUS_PX = 22

/** A viewport position independent of the container's size: the map point
 * at the centre (0–1 on each axis) and the zoom relative to fit. */
export interface MapView {
  centerX: number
  centerY: number
  zoom: number
}

export interface MapViewportHandle {
  fit: () => void
  zoomBy: (factor: number) => void
  /** Brings a map point (0–1) to the centre, zooming in to at least
   * `minZoom` if given. */
  centerOn: (x: number, y: number, minZoom?: number) => void
  getView: () => MapView
  setView: (view: MapView) => void
}

export interface MapViewportProps extends MapCanvasProps {
  /** Accessible name of the map area, e.g. "Map: The Northern March". */
  label: string
  /** Fill the parent's height (the map workspace) instead of a fixed box. */
  fill?: boolean
  /** How the map first fits: the whole map (`contain`), or filling the
   * area edge to edge (`cover`, for phones). "Show the whole map" always
   * fits it whole. */
  fitMode?: 'contain' | 'cover'
  initialView?: MapView
  onViewChange?: (view: MapView) => void
  /** Escape while the map has focus (e.g. clear the selection). */
  onEscape?: () => void
  /** Extra controls appended to the zoom toolbar (e.g. full screen). */
  toolbarExtra?: ReactNode
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Wraps MapCanvas with a pannable/zoomable work area: the map is fitted
 * inside the container, then scroll/pinch/buttons/keys zoom and dragging or
 * arrow keys pan. Pins keep working at any zoom — their own pointer handlers
 * stop propagation, and CSS transforms don't affect getBoundingClientRect(),
 * so MapCanvas's click/drag position math stays correct — and are drawn at a
 * constant size (counter-scaled) so they stay readable when zoomed.
 *
 * When the container resizes (sidebar, inspector, window), the map point at
 * the centre and the on-screen scale are kept, so nothing jumps; until the
 * user has zoomed or panned, the map simply stays fitted. */
export const MapViewport = forwardRef<MapViewportHandle, MapViewportProps>(function MapViewport(
  { label, fill = false, fitMode = 'contain', initialView, onViewChange, onEscape, toolbarExtra, ...canvasProps },
  ref,
) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const hintId = useId()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const imageWidth = canvasProps.imageWidth ?? natural?.width ?? null
  const imageHeight = canvasProps.imageHeight ?? natural?.height ?? null
  const aspect = imageWidth && imageHeight ? imageWidth / imageHeight : 16 / 10

  // Fitted ("zoom 1") size of the map inside the container.
  const base =
    size.width > 0 && size.height > 0
      ? size.width / size.height > aspect
        ? { width: size.height * aspect, height: size.height }
        : { width: size.width, height: size.width / aspect }
      : { width: 0, height: 0 }
  const maxZoom = Math.max(MAX_ZOOM, imageWidth && base.width ? (2 * imageWidth) / base.width : MAX_ZOOM)

  const [view, setViewState] = useState<MapView>(initialView ?? { centerX: 0.5, centerY: 0.5, zoom: 1 })
  // Which fit the view is in until the user zooms or pans (null after):
  // a resize then re-fits instead of keeping the scale.
  const fittedRef = useRef<'contain' | 'cover' | null>(initialView ? null : fitMode)
  const viewRef = useRef(view)
  viewRef.current = view
  const baseRef = useRef(base)
  baseRef.current = base
  const sizeRef = useRef(size)
  sizeRef.current = size
  const maxZoomRef = useRef(maxZoom)
  maxZoomRef.current = maxZoom
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange

  /** Zoom (relative to `contain`) that makes the map cover a container. */
  const coverZoom = useCallback(
    (width: number, height: number) => {
      if (width === 0 || height === 0) return 1
      const containWidth = width / height > aspect ? height * aspect : width
      const containHeight = containWidth / aspect
      return Math.max(width / containWidth, height / containHeight)
    },
    [aspect],
  )

  const commit = useCallback((next: MapView) => {
    const clamped = {
      centerX: clamp(next.centerX, 0, 1),
      centerY: clamp(next.centerY, 0, 1),
      zoom: clamp(next.zoom, MIN_ZOOM, maxZoomRef.current),
    }
    viewRef.current = clamped
    setViewState(clamped)
    onViewChangeRef.current?.(clamped)
  }, [])

  // Container size, kept current by a ResizeObserver. Keeps the on-screen
  // scale across resizes (zoom is relative to fit, which changes with size).
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const measure = (width: number, height: number) => {
      const previous = sizeRef.current
      if (width === previous.width && height === previous.height) return
      const previousBase = baseRef.current.width
      const nextBaseWidth = width / height > aspect ? height * aspect : width
      // Update the refs now, not on the next render: several resize
      // callbacks can arrive before React re-renders, and each must build
      // on the last one (or the scale correction is applied twice).
      sizeRef.current = { width, height }
      baseRef.current = { width: nextBaseWidth, height: nextBaseWidth / aspect }
      setSize({ width, height })
      if (fittedRef.current) {
        commit({ centerX: 0.5, centerY: 0.5, zoom: fittedRef.current === 'cover' ? coverZoom(width, height) : 1 })
        return
      }
      if (previous.width === 0 || previousBase === 0 || nextBaseWidth === 0) return
      const current = viewRef.current
      commit({ ...current, zoom: (current.zoom * previousBase) / nextBaseWidth })
    }
    const rect = surface.getBoundingClientRect()
    measure(Math.round(rect.width), Math.round(rect.height))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height))
    })
    observer.observe(surface)
    return () => observer.disconnect()
  }, [aspect, commit, coverZoom, canvasProps.imageUrl])

  // A fitted view follows the fit when the layout changes it (a window
  // narrowed to phone width switches to cover, and back).
  useEffect(() => {
    if (!fittedRef.current || fittedRef.current === fitMode) return
    fittedRef.current = fitMode
    const { width, height } = sizeRef.current
    commit({ centerX: 0.5, centerY: 0.5, zoom: fitMode === 'cover' ? coverZoom(width, height) : 1 })
  }, [fitMode, commit, coverZoom])

  // At the current zoom: which pins overlap (grouped) and which have room
  // for their name.
  const { pins, selectedPinId } = canvasProps
  const layout = useMemo(() => {
    if (base.width === 0) return null
    const points = pins.map((pin) => ({
      pin,
      x: pin.xNormalized * base.width * view.zoom,
      y: pin.yNormalized * base.height * view.zoom,
    }))
    const groups = groupOverlapping(points, CLUSTER_RADIUS_PX, selectedPinId)
    const singles = new Set(groups.filter((group) => group.pins.length === 1).map((group) => group.pins[0]!.id))
    return {
      groups,
      labelled: pinsWithRoomForLabels(
        points.filter((point) => singles.has(point.pin.id)),
        selectedPinId,
        groups.map((group) => ({
          x: group.xNormalized * base.width * view.zoom,
          y: group.yNormalized * base.height * view.zoom,
        })),
      ),
    }
  }, [pins, base.width, base.height, view.zoom, selectedPinId])

  // Pan offset (px) of the stage's top-left corner for the current view.
  const pan = {
    x: size.width / 2 - view.centerX * base.width * view.zoom,
    y: size.height / 2 - view.centerY * base.height * view.zoom,
  }

  /** Zooms keeping the map point under `anchor` (container px) still. */
  const zoomAround = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      const current = viewRef.current
      const b = baseRef.current
      const s = sizeRef.current
      if (b.width === 0) return
      const point = anchor ?? { x: s.width / 2, y: s.height / 2 }
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, maxZoomRef.current)
      const panX = s.width / 2 - current.centerX * b.width * current.zoom
      const panY = s.height / 2 - current.centerY * b.height * current.zoom
      // Map point under the anchor, in normalized coordinates.
      const mx = (point.x - panX) / (b.width * current.zoom)
      const my = (point.y - panY) / (b.height * current.zoom)
      const nextPanX = point.x - mx * b.width * nextZoom
      const nextPanY = point.y - my * b.height * nextZoom
      fittedRef.current = null
      commit({
        zoom: nextZoom,
        centerX: (s.width / 2 - nextPanX) / (b.width * nextZoom),
        centerY: (s.height / 2 - nextPanY) / (b.height * nextZoom),
      })
    },
    [commit],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const current = viewRef.current
      const b = baseRef.current
      if (b.width === 0) return
      fittedRef.current = null
      commit({
        ...current,
        centerX: current.centerX - dx / (b.width * current.zoom),
        centerY: current.centerY - dy / (b.height * current.zoom),
      })
    },
    [commit],
  )

  const fit = useCallback(() => {
    fittedRef.current = 'contain'
    commit({ centerX: 0.5, centerY: 0.5, zoom: 1 })
  }, [commit])

  useImperativeHandle(
    ref,
    () => ({
      fit,
      zoomBy: (factor) => zoomAround(factor),
      centerOn: (x, y, minZoom) => {
        fittedRef.current = null
        commit({ centerX: x, centerY: y, zoom: Math.max(viewRef.current.zoom, minZoom ?? 0) })
      },
      getView: () => viewRef.current,
      setView: (next) => {
        fittedRef.current = null
        commit(next)
      },
    }),
    [commit, fit, zoomAround],
  )

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const downPosition = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const suppressNextClick = useRef(false)
  const lastPinchDistance = useRef<number | null>(null)

  function surfacePoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = surfaceRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }

  // Not a React onWheel prop: React attaches its delegated wheel listener
  // as passive, so event.preventDefault() inside a synthetic onWheel
  // handler is silently ignored and the page scrolls underneath the map —
  // a real, non-passive listener is the only way to stop that scroll.
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !canvasProps.imageUrl) return
    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = surface!.getBoundingClientRect()
      zoomAround(Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [canvasProps.imageUrl, zoomAround])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canvasProps.imageUrl) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    // Pointer capture is deferred to handlePointerMove, once a drag/pinch is
    // actually confirmed — a captured pointer's `click` is retargeted to
    // this surface, so capturing every plain click would stop MapCanvas's
    // own click handlers (place a pin, dismiss the selection) from firing.
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
      const mid = midpoint(a, b)
      if (lastPinchDistance.current === null) {
        event.currentTarget.setPointerCapture(event.pointerId)
      } else {
        zoomAround(currentDistance / lastPinchDistance.current, surfacePoint(mid.x, mid.y))
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
    panBy(event.clientX - previous.x, event.clientY - previous.y)
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

  // A drag-to-pan still ends with a native `click` wherever the pointer
  // landed — without this, panning would also place a pin (edit mode) or
  // clear the selection (view mode).
  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressNextClick.current) return
    suppressNextClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Only when the map area itself has focus — not a pin inside it.
    if (event.target !== event.currentTarget) return
    const step = event.shiftKey ? KEY_PAN_PX * 3 : KEY_PAN_PX
    const handlers: Record<string, () => void> = {
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
      '+': () => zoomAround(BUTTON_ZOOM_STEP),
      '=': () => zoomAround(BUTTON_ZOOM_STEP),
      '-': () => zoomAround(1 / BUTTON_ZOOM_STEP),
      '0': fit,
      // Only claimed when there's a handler: otherwise the page's own
      // Escape (e.g. leaving At the Table) still gets it.
      ...(onEscape ? { Escape: onEscape } : {}),
    }
    const handler = handlers[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  if (!canvasProps.imageUrl) {
    return (
      <div className={['wb-map-viewport', fill ? 'wb-map-viewport--fill' : ''].filter(Boolean).join(' ')}>
        <MapCanvas {...canvasProps} />
      </div>
    )
  }

  const stageStyle = {
    width: `${base.width}px`,
    height: `${base.height}px`,
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${view.zoom})`,
    '--wb-map-zoom': String(view.zoom),
  } as CSSProperties

  return (
    <div className={['wb-map-viewport', fill ? 'wb-map-viewport--fill' : ''].filter(Boolean).join(' ')}>
      <MapToolbar
        zoom={view.zoom}
        onZoomIn={() => zoomAround(BUTTON_ZOOM_STEP)}
        onZoomOut={() => zoomAround(1 / BUTTON_ZOOM_STEP)}
        onReset={fit}
      >
        {toolbarExtra}
      </MapToolbar>
      <span id={hintId} className="wb-visually-hidden">
        Arrow keys move the map, plus and minus zoom, 0 shows the whole map. Pins are buttons; Tab moves
        between them.
      </span>
      {/* The map area is one focusable widget for keyboard panning and
          zooming (role="application" so screen readers pass the keys
          through); pins inside it remain ordinary buttons. jsx-a11y doesn't
          count role="application" as interactive, but this is one. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={surfaceRef}
        className={[
          'wb-map-viewport__surface',
          canvasProps.onCanvasPlace ? 'wb-map-viewport__surface--placing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="application"
        aria-roledescription="map"
        aria-label={label}
        aria-describedby={hintId}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        onClick={(event) => {
          // Anywhere on the map that isn't a pin (or a placement, which
          // MapCanvas stops): around the image as well as on it.
          if ((event.target as HTMLElement).closest('.wb-map-pin, .wb-map-cluster')) return
          canvasProps.onBackgroundClick?.()
        }}
      >
        <div className="wb-map-viewport__stage" style={stageStyle}>
          <MapCanvas
            {...canvasProps}
            layout={layout}
            onImageLoad={(width, height) => {
              if (!canvasProps.imageWidth || !canvasProps.imageHeight) setNatural({ width, height })
            }}
          />
        </div>
      </div>
    </div>
  )
})
