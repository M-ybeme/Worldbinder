import type { MapLayerSummary } from '@worldbinder/contracts'

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
            <label>
              <input
                type="checkbox"
                checked={visibleLayerIds.has(layer.id)}
                onChange={() => onToggleLayer(layer.id)}
              />
              {layer.name}
              {layer.visibility === 'gm_only' ? ' (GM only)' : ''}
            </label>
          </li>
        ))}
        {hasUnlayeredPins && (
          <li>
            <label>
              <input type="checkbox" checked={showUnlayered} onChange={onToggleUnlayered} />
              Unlayered pins
            </label>
          </li>
        )}
      </ul>
    </fieldset>
  )
}
