import type { MapLayerSummary, MapPinSummary, TiptapDoc } from '@worldbinder/contracts'
import type { UpdateEntityInput } from '@worldbinder/validation'
import {
  Button,
  ErrorState,
  FormMessage,
  IconButton,
  LoadingState,
  TextField,
} from '@worldbinder/ui'
import { ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntityTypeIcon } from '../../entities/lib/entityTypeIcons'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { useEntityQuery, useUpdateEntityMutation } from '../../entities/hooks/useEntities'
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
 * editing a pin's info no longer loses the map's pan/zoom context. */
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

      {pin?.locationEntityId && (
        <EntityPinContent
          campaignId={campaignId}
          entityId={pin.locationEntityId}
          canEdit={canManage}
        />
      )}

      {!canManage && !pin?.locationEntityId && <p>This pin has no additional info.</p>}
    </aside>
  )
}

interface EntityPinContentProps {
  campaignId: string
  entityId: string
  canEdit: boolean
}

/** The linked entity's title/body, previewed (and, for GMs/editors,
 * editable) without leaving the map. GM-only content is deliberately not
 * shown here — this mirrors what's already visible on the map itself; a GM
 * who needs it has "Open full page". */
function EntityPinContent({ campaignId, entityId, canEdit }: EntityPinContentProps) {
  const entityQuery = useEntityQuery(campaignId, entityId)
  const updateEntity = useUpdateEntityMutation(campaignId, entityId)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState<TiptapDoc | null>(null)

  useEffect(() => {
    if (!entityQuery.data) return
    setName(entityQuery.data.name)
    setContent(entityQuery.data.publicContentJson)
    setEditing(false)
  }, [entityQuery.data])

  if (entityQuery.isLoading) return <LoadingState label="Loading entity…" />
  if (entityQuery.isError || !entityQuery.data) {
    return (
      <ErrorState
        message="This entity could not be loaded."
        onRetry={() => entityQuery.refetch()}
      />
    )
  }
  const entity = entityQuery.data

  if (!canEdit || !editing) {
    return (
      <div className="wb-map-pin-panel__entity-content">
        <h3>{entity.name}</h3>
        <RichTextEditor
          key={entity.id}
          label="Content"
          content={entity.publicContentJson}
          editable={false}
          campaignId={campaignId}
        />
        {canEdit && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="wb-map-pin-panel__entity-content">
      <TextField
        id="pin-entity-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <RichTextEditor
        key={entity.id}
        label="Content"
        content={entity.publicContentJson}
        onChange={setContent}
        campaignId={campaignId}
      />
      <FormMessage message={updateEntity.error?.message} tone="error" />
      <div className="wb-entity-header__actions">
        <Button
          disabled={updateEntity.isPending}
          onClick={() =>
            updateEntity.mutate(
              {
                entityType: entity.entityType,
                updatedAt: entity.updatedAt,
                name,
                publicContentJson: content ?? undefined,
              } as UpdateEntityInput,
              { onSuccess: () => setEditing(false) },
            )
          }
        >
          {updateEntity.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setName(entity.name)
            setContent(entity.publicContentJson)
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
