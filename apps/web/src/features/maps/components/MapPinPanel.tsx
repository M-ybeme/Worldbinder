import type { MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { IconButton } from '@worldbinder/ui'
import { ExternalLink, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EntityTypeIcon } from '../../entities/lib/entityTypeIcons'
import { MapPinForm, type MapPinFormValues } from './MapPinForm'
import '../maps.css'

export interface MapPinPanelProps {
  campaignId: string
  layers: MapLayerSummary[]
  canManage: boolean
  /** Existing pin being viewed/edited, or null while placing a new one
   * (manage mode only — `initialPosition` supplies its starting spot). */
  pin: MapPinSummary | null
  initialPosition: { x: number; y: number }
  onSubmit: (values: MapPinFormValues) => void
  onClose: () => void
  onDelete?: () => void
  isSaving: boolean
  error?: string | null
}

/** Docked side panel opened by selecting a pin — replaces both the old
 * "navigate straight to the entity page" view-mode behavior and the old
 * "inline form below the canvas" manage-mode behavior, so checking or
 * editing a pin no longer loses the map's pan/zoom context. Holds only the
 * pin's own fields (label/layer/visibility/position/delete) — the linked
 * entity's actual title/body renders separately, full-width below the map
 * (MapPinEntityContent, rendered by MapDetailPage), since that content
 * wants the map's own width rather than a 320px rail. */
export function MapPinPanel({
  campaignId,
  layers,
  canManage,
  pin,
  initialPosition,
  onSubmit,
  onClose,
  onDelete,
  isSaving,
  error,
}: MapPinPanelProps) {
  const title = pin?.label ?? pin?.locationEntityName ?? (pin ? 'Unlabeled pin' : 'New pin')

  return (
    <aside className="wb-map-pin-panel">
      <header className="wb-map-pin-panel__header">
        <span className="wb-map-pin-panel__title">
          {pin?.locationEntityType && <EntityTypeIcon type={pin.locationEntityType} size={18} />}
          {title}
        </span>
        <div className="wb-map-pin-panel__header-actions">
          {pin?.locationEntityId && (
            <Link
              className="wb-icon-button"
              aria-label="Open full page"
              title="Open full page"
              to={`/app/campaign/${campaignId}/world/${pin.locationEntityId}`}
            >
              <ExternalLink size={18} aria-hidden="true" />
            </Link>
          )}
          <IconButton label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {canManage && (
        <MapPinForm
          campaignId={campaignId}
          layers={layers}
          pin={pin}
          initialPosition={initialPosition}
          onSubmit={onSubmit}
          onCancel={onClose}
          onDelete={onDelete}
          isSaving={isSaving}
          error={error}
        />
      )}

      {!canManage && !pin?.locationEntityId && <p>This pin has no additional info.</p>}
    </aside>
  )
}
