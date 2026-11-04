import type { MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { Badge } from '@worldbinder/ui'
import { Search } from 'lucide-react'
import { useId } from 'react'
import { ENTITY_TYPE_LABELS } from '../../entities/lib/entityTypeIcons'
import {
  isFiltering,
  matchesFilter,
  NO_FILTER,
  pinKind,
  pinLabel,
  type PinFilter,
  type PinKind,
} from '../lib/pins'

const kindLabel = (kind: PinKind) => (kind === 'none' ? 'No entry' : ENTITY_TYPE_LABELS[kind])

/**
 * Every pin on the map — searchable by name, entry summary or layer,
 * narrowed by kind and (when the map has GM-only pins) visibility, and
 * grouped by layer. The same filter also narrows what the map shows.
 * Only pins this viewer may see ever reach here: the API drops the rest.
 */
export function PinBrowser({
  pins,
  layers,
  hiddenLayerIds,
  showUnlayered,
  filter,
  onFilterChange,
  selectedPinId,
  onSelect,
}: {
  pins: MapPinSummary[]
  layers: MapLayerSummary[]
  hiddenLayerIds: Set<string>
  showUnlayered: boolean
  filter: PinFilter
  onFilterChange: (filter: PinFilter) => void
  selectedPinId: string | null
  onSelect: (pin: MapPinSummary) => void
}) {
  const searchId = useId()
  const layerName = new Map(layers.map((layer) => [layer.id, layer.name]))
  const matching = pins.filter((pin) => matchesFilter(pin, filter, pin.layerId ? layerName.get(pin.layerId) : undefined))

  const kinds = new Map<PinKind, number>()
  for (const pin of pins) kinds.set(pinKind(pin), (kinds.get(pinKind(pin)) ?? 0) + 1)
  const hasGmPins = pins.some((pin) => pin.visibility === 'gm_only')

  const groups = [
    ...layers.map((layer) => ({
      key: layer.id,
      name: layer.name,
      gmOnly: layer.visibility === 'gm_only',
      hidden: hiddenLayerIds.has(layer.id),
      pins: matching.filter((pin) => pin.layerId === layer.id),
    })),
    {
      key: 'none',
      name: 'No layer',
      gmOnly: false,
      hidden: !showUnlayered,
      pins: matching.filter((pin) => !pin.layerId),
    },
  ].filter((group) => group.pins.length > 0)

  function toggleKind(kind: PinKind) {
    const next = new Set(filter.kinds)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    onFilterChange({ ...filter, kinds: next })
  }

  return (
    <section className="wb-mapws__section" aria-labelledby={`${searchId}-title`}>
      <h2 id={`${searchId}-title`} className="wb-mapws__eyebrow">
        Pins <span className="wb-mapws__count">{pins.length}</span>
      </h2>
      <div className="wb-pin-browser__search" role="search">
        <Search size={16} aria-hidden="true" />
        <label htmlFor={searchId} className="wb-visually-hidden">
          Find a pin
        </label>
        <input
          id={searchId}
          type="search"
          className="wb-field__input"
          placeholder="Find a pin…"
          value={filter.query}
          onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
        />
      </div>
      {(kinds.size > 1 || hasGmPins) && (
        <div className="wb-pin-browser__filters" role="group" aria-label="Filter pins">
          {[...kinds.entries()]
            .sort((a, b) => kindLabel(a[0]).localeCompare(kindLabel(b[0])))
            .map(([kind, count]) => (
              <button
                key={kind}
                type="button"
                className="wb-pin-browser__chip"
                aria-pressed={filter.kinds.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                {kindLabel(kind)} <span className="wb-pin-browser__chip-count">{count}</span>
              </button>
            ))}
          {hasGmPins &&
            (['public', 'gm_only'] as const).map((visibility) => (
              <button
                key={visibility}
                type="button"
                className="wb-pin-browser__chip"
                aria-pressed={filter.visibility === visibility}
                onClick={() =>
                  onFilterChange({ ...filter, visibility: filter.visibility === visibility ? 'all' : visibility })
                }
              >
                {visibility === 'public' ? 'Everyone can see' : 'GM only'}
              </button>
            ))}
        </div>
      )}
      {isFiltering(filter) && (
        <p className="wb-pin-browser__status" aria-live="polite">
          Showing {matching.length} of {pins.length}{' '}
          <button type="button" className="wb-pin-browser__clear" onClick={() => onFilterChange(NO_FILTER)}>
            Clear
          </button>
        </p>
      )}
      {pins.length > 0 && matching.length === 0 && <p className="wb-mapws__muted">No pins match.</p>}
      {groups.map((group) => (
        <div key={group.key} className="wb-mapws__group">
          <h3 className="wb-mapws__group-title">
            {group.name}
            {group.gmOnly && <Badge tone="warning">GM only</Badge>}
            {group.hidden && <span className="wb-mapws__muted">(hidden on the map)</span>}
          </h3>
          <ul className="wb-mapws__pins">
            {group.pins.map((pin) => (
              <li key={pin.id}>
                <button
                  type="button"
                  className="wb-mapws__pin-row"
                  aria-current={pin.id === selectedPinId || undefined}
                  onClick={() => onSelect(pin)}
                >
                  <span className="wb-mapws__pin-name">{pinLabel(pin)}</span>
                  <span className="wb-mapws__muted">
                    {kindLabel(pinKind(pin))}
                    {pin.visibility === 'gm_only' && ' · GM only'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
