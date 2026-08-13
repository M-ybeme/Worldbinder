import type { MapLayerSummary } from '@worldbinder/contracts'
import { Badge, Checkbox } from '@worldbinder/ui'
import '../maps.css'

export interface MapLayerTogglesProps {
  layers: MapLayerSummary[]
  hasUnlayeredPins: boolean
  visibleLayerIds: Set<string>
  showUnlayered: boolean
  onToggleLayer: (layerId: string) => void
  onToggleUnlayered: () => void
}

/** Client-side filter toggles (the milestone's "Filters" deliverable) —
 * drives both MapCanvas and AccessiblePinList from one shared state, so
 * hiding a layer hides its pins in both places at once. */
export function MapLayerToggles({
  layers,
  hasUnlayeredPins,
  visibleLayerIds,
  showUnlayered,
  onToggleLayer,
  onToggleUnlayered,
}: MapLayerTogglesProps) {
  if (layers.length === 0 && !hasUnlayeredPins) return null

  return (
    <fieldset className="wb-map-layer-toggles">
      <legend>Layers</legend>
      <ul>
        {layers.map((layer) => (
          <li key={layer.id}>
            <Checkbox
              checked={visibleLayerIds.has(layer.id)}
              onChange={() => onToggleLayer(layer.id)}
              label={
                <>
                  {layer.name}
                  {layer.visibility === 'gm_only' && (
                    <>
                      {' '}
                      <Badge tone="warning">GM only</Badge>
                    </>
                  )}
                </>
              }
            />
          </li>
        ))}
        {hasUnlayeredPins && (
          <li>
            <Checkbox checked={showUnlayered} onChange={onToggleUnlayered} label="Unlayered pins" />
          </li>
        )}
      </ul>
    </fieldset>
  )
}
