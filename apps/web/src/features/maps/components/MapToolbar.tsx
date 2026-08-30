import { IconButton } from '@worldbinder/ui'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import '../maps.css'

export interface MapToolbarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

/** Floating overlay controls for MapViewport's pan/zoom state — the
 * keyboard/no-scroll-wheel equivalent of scroll-to-zoom and drag-to-pan. */
export function MapToolbar({ zoom, onZoomIn, onZoomOut, onReset }: MapToolbarProps) {
  return (
    <div className="wb-map-toolbar">
      <IconButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={18} aria-hidden="true" />
      </IconButton>
      <span className="wb-map-toolbar__zoom">{Math.round(zoom * 100)}%</span>
      <IconButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={18} aria-hidden="true" />
      </IconButton>
      <IconButton label="Reset view" onClick={onReset}>
        <Maximize size={18} aria-hidden="true" />
      </IconButton>
    </div>
  )
}
