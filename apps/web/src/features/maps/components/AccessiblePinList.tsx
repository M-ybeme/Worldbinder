import type { MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'

export interface AccessiblePinListProps {
  pins: MapPinSummary[]
  layers: MapLayerSummary[]
  onActivate: (pin: MapPinSummary) => void
}

/** Keyboard-reachable equivalent of the visual canvas (roadmap Milestone 10
 * exit criterion: "keyboard users can access all pin content") — a plain
 * button list doing the same activation as clicking a pin, not a parallel
 * accessibility tree layered onto the absolutely-positioned canvas. */
export function AccessiblePinList({ pins, layers, onActivate }: AccessiblePinListProps) {
  const layerNameById = new Map(layers.map((layer) => [layer.id, layer.name]))

  return (
    <div className="wb-map-pin-list">
      <h2>Pins</h2>
      {pins.length === 0 && <p>No pins on this map yet.</p>}
      <ul>
        {pins.map((pin) => {
          const label = pin.label ?? pin.locationEntityName ?? 'Unlabeled pin'
          const layerName = pin.layerId ? layerNameById.get(pin.layerId) : null
          return (
            <li key={pin.id}>
              <button type="button" onClick={() => onActivate(pin)}>
                {label}
              </button>
              <span className="wb-session-list__meta">
                {pin.locationEntityType ? ` · ${pin.locationEntityType}` : ''}
                {layerName ? ` · ${layerName}` : ''}
                {pin.visibility === 'gm_only' ? ' · GM only' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
