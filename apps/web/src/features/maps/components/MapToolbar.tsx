import { IconButton } from '@worldbinder/ui'
import { Scan, ZoomIn, ZoomOut } from 'lucide-react'
import type { ReactNode } from 'react'
import '../maps.css'

export interface MapToolbarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  /** Show the whole map again. */
  onReset: () => void
  /** Extra controls after the zoom ones (e.g. full screen). */
  children?: ReactNode
}

/** Floating overlay controls for MapViewport's pan/zoom state — the
 * keyboard/no-scroll-wheel/no-pinch equivalent of zooming and panning. */
export function MapToolbar({ zoom, onZoomIn, onZoomOut, onReset, children }: MapToolbarProps) {
  return (
    <div className="wb-map-toolbar" role="group" aria-label="Map view">
      <IconButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={18} aria-hidden="true" />
      </IconButton>
      <span className="wb-map-toolbar__zoom" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={18} aria-hidden="true" />
      </IconButton>
      <IconButton label="Show the whole map" onClick={onReset}>
        <Scan size={18} aria-hidden="true" />
      </IconButton>
      {children}
    </div>
  )
}
