import type { MapPinSummary } from '@worldbinder/contracts'
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  FormMessage,
  LoadingState,
  TextField,
} from '@worldbinder/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { AccessiblePinList } from '../components/AccessiblePinList'
import '../maps.css'
import { MapViewport } from '../components/MapViewport'
import { MapLayerToggles } from '../components/MapLayerToggles'
import { MapPinPanel } from '../components/MapPinPanel'
import type { MapPinFormValues } from '../components/MapPinForm'
import {
  useCreateMapLayerMutation,
  useCreateMapPinMutation,
  useDeleteMapLayerMutation,
  useDeleteMapMutation,
  useDeleteMapPinMutation,
  useMapQuery,
  useRepositionMapPinMutation,
  useUpdateMapPinMutation,
} from '../hooks/useMaps'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function MapDetailPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

  const mapQuery = useMapQuery(campaign.id, mapId)
  const deleteMap = useDeleteMapMutation(campaign.id)
  const createLayer = useCreateMapLayerMutation(campaign.id, mapId ?? '')
  const deleteLayer = useDeleteMapLayerMutation(campaign.id, mapId ?? '')
  const createPin = useCreateMapPinMutation(campaign.id, mapId ?? '')
  const updatePin = useUpdateMapPinMutation(campaign.id, mapId ?? '')
  const repositionPin = useRepositionMapPinMutation(campaign.id, mapId ?? '')
  const deletePin = useDeleteMapPinMutation(campaign.id, mapId ?? '')

  const [manageMode, setManageMode] = useState(false)
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set())
  const [showUnlayered, setShowUnlayered] = useState(true)
  const [selectedPin, setSelectedPin] = useState<MapPinSummary | null>(null)
  const [placingPosition, setPlacingPosition] = useState<{ x: number; y: number } | null>(null)
  // True between clicking "+ New pin" and the next map click — while armed,
  // the next click anywhere on the map drops the pin there instead of doing
  // nothing. Kept separate from `placingPosition` so an accidental
  // background click can't ever start a new pin: only an explicit "+ New
  // pin" arms this.
  const [armedForNewPin, setArmedForNewPin] = useState(false)
  const [newLayerName, setNewLayerName] = useState('')
  const [confirmDeletePin, setConfirmDeletePin] = useState(false)
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false)
  const [deletingLayer, setDeletingLayer] = useState<{ id: string; name: string } | null>(null)

  if (mapQuery.isLoading) return <LoadingState label="Loading map…" />
  if (mapQuery.isError || !mapQuery.data) {
    return <ErrorState message="This map could not be loaded." onRetry={() => mapQuery.refetch()} />
  }
  const map = mapQuery.data

  const visiblePins = map.pins.filter((pin) =>
    pin.layerId ? !hiddenLayerIds.has(pin.layerId) : showUnlayered,
  )

  // Selecting a pin always opens the side panel — a docked preview/edit
  // surface, not a full-data popup, so it doesn't lose the map's pan/zoom
  // context the way navigating straight to the entity page used to
  // (ui-ux.md's "not a giant popup" concern still holds; "Open full page"
  // inside the panel is the explicit path to the canonical entity page).
  function handlePinActivate(pin: MapPinSummary) {
    setArmedForNewPin(false)
    setPlacingPosition(null)
    setSelectedPin(pin)
  }

  // Only wired up while armed (see onCanvasPlace below) — the click that
  // drops the new pin exactly where the user clicked, then opens the panel
  // to fill in its info.
  function handleCanvasPlace(x: number, y: number) {
    setArmedForNewPin(false)
    setSelectedPin(null)
    setPlacingPosition({ x, y })
  }

  function beginPlacingNewPin() {
    setSelectedPin(null)
    setPlacingPosition(null)
    setArmedForNewPin(true)
  }

  function handlePinFormSubmit(values: MapPinFormValues) {
    const { xNormalized, yNormalized, ...rest } = values
    const payload = { ...rest, label: values.label || null }
    if (selectedPin) {
      updatePin.mutate(
        { pinId: selectedPin.id, input: payload },
        { onSuccess: () => setSelectedPin(null) },
      )
      if (xNormalized !== selectedPin.xNormalized || yNormalized !== selectedPin.yNormalized) {
        repositionPin.mutate({ pinId: selectedPin.id, input: { xNormalized, yNormalized } })
      }
    } else {
      createPin.mutate(
        { ...payload, xNormalized, yNormalized },
        { onSuccess: () => setPlacingPosition(null) },
      )
    }
  }

  function handlePinDelete() {
    if (!selectedPin) return
    setConfirmDeletePin(true)
  }

  return (
    <section>
      <header className="wb-world-header">
        <h1>{map.name}</h1>
        {canManage && (
          <div className="wb-entity-header__actions">
            <Button
              variant="secondary"
              onClick={() => {
                setManageMode((v) => !v)
                setSelectedPin(null)
                setPlacingPosition(null)
                setArmedForNewPin(false)
              }}
            >
              {manageMode ? 'Done editing' : 'Edit pins & layers'}
            </Button>
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/maps/${map.id}/edit`}
            >
              Map settings
            </Link>
            <Button variant="secondary" onClick={() => setConfirmDeleteMap(true)}>
              Delete map
            </Button>
          </div>
        )}
      </header>
      {map.description && <p>{map.description}</p>}
      {manageMode && armedForNewPin && (
        <p className="wb-map-discoverability-hint">
          Click anywhere on the map to place the new pin there.{' '}
          <Button variant="secondary" onClick={() => handleCanvasPlace(0.5, 0.5)}>
            Place at center instead
          </Button>{' '}
          <Button variant="secondary" onClick={() => setArmedForNewPin(false)}>
            Cancel
          </Button>
        </p>
      )}
      {manageMode && !armedForNewPin && (
        <p>
          Drag an existing pin to move it — the pin form's position fields work without a pointer,
          too.{' '}
          <Button variant="secondary" onClick={beginPlacingNewPin}>
            + New pin
          </Button>
        </p>
      )}
      {canManage && !manageMode && (
        <p className="wb-map-discoverability-hint">
          <Button
            variant="secondary"
            onClick={() => {
              setManageMode(true)
              beginPlacingNewPin()
            }}
          >
            + Add pin
          </Button>{' '}
          {map.layers.length > 0
            ? `${map.layers.length} ${map.layers.length === 1 ? 'layer' : 'layers'} — Edit pins & layers to manage them.`
            : 'Edit pins & layers to organize pins into layers.'}
        </p>
      )}

      <MapLayerToggles
        layers={map.layers}
        hasUnlayeredPins={map.pins.some((pin) => !pin.layerId)}
        visibleLayerIds={
          new Set(map.layers.filter((l) => !hiddenLayerIds.has(l.id)).map((l) => l.id))
        }
        showUnlayered={showUnlayered}
        onToggleLayer={(layerId) =>
          setHiddenLayerIds((prev) => {
            const next = new Set(prev)
            if (next.has(layerId)) next.delete(layerId)
            else next.add(layerId)
            return next
          })
        }
        onToggleUnlayered={() => setShowUnlayered((v) => !v)}
      />

      <div className="wb-map-detail-layout">
        <div className="wb-map-detail-layout__main">
          <MapViewport
            imageUrl={map.imageUrl}
            imageWidth={map.imageWidth}
            imageHeight={map.imageHeight}
            pins={visiblePins}
            manageMode={manageMode}
            onPinActivate={handlePinActivate}
            onCanvasPlace={manageMode && armedForNewPin ? handleCanvasPlace : undefined}
            onPinReposition={
              manageMode
                ? (pinId, x, y) =>
                    repositionPin.mutate({ pinId, input: { xNormalized: x, yNormalized: y } })
                : undefined
            }
          />
        </div>

        {(selectedPin || placingPosition) && (
          <div className="wb-map-detail-layout__panel">
            <MapPinPanel
              campaignId={campaign.id}
              layers={map.layers}
              canManage={canManage}
              pin={selectedPin}
              initialPosition={
                selectedPin
                  ? { x: selectedPin.xNormalized, y: selectedPin.yNormalized }
                  : (placingPosition ?? { x: 0.5, y: 0.5 })
              }
              onSubmit={handlePinFormSubmit}
              onClose={() => {
                setSelectedPin(null)
                setPlacingPosition(null)
              }}
              onDelete={selectedPin ? handlePinDelete : undefined}
              isSaving={createPin.isPending || updatePin.isPending || deletePin.isPending}
              error={
                createPin.error?.message ?? updatePin.error?.message ?? deletePin.error?.message
              }
            />
          </div>
        )}
      </div>

      <AccessiblePinList pins={visiblePins} layers={map.layers} onActivate={handlePinActivate} />

      {canManage && manageMode && (
        <div className="wb-map-layer-manager">
          <h2>Manage layers</h2>
          <ul>
            {map.layers.map((layer) => (
              <li key={layer.id}>
                {layer.name}
                {layer.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
                <Button
                  variant="secondary"
                  disabled={deleteLayer.isPending}
                  onClick={() => setDeletingLayer({ id: layer.id, name: layer.name })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="wb-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newLayerName.trim()) return
              createLayer.mutate({ name: newLayerName }, { onSuccess: () => setNewLayerName('') })
            }}
            noValidate
          >
            <TextField
              id="new-layer-name"
              label="New layer name"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
            />
            <Button type="submit" disabled={createLayer.isPending}>
              Add layer
            </Button>
          </form>
          <FormMessage
            message={createLayer.error?.message ?? deleteLayer.error?.message}
            tone="error"
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeletePin}
        title="Delete this pin?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deletePin.isPending}
        onConfirm={() => {
          setConfirmDeletePin(false)
          if (selectedPin)
            deletePin.mutate(selectedPin.id, { onSuccess: () => setSelectedPin(null) })
        }}
        onCancel={() => setConfirmDeletePin(false)}
      />

      <ConfirmDialog
        open={confirmDeleteMap}
        title={`Delete "${map.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteMap.isPending}
        onConfirm={() => {
          setConfirmDeleteMap(false)
          deleteMap.mutate(map.id, {
            onSuccess: () => navigate(`/app/campaign/${campaign.id}/maps`),
          })
        }}
        onCancel={() => setConfirmDeleteMap(false)}
      />

      <ConfirmDialog
        open={deletingLayer !== null}
        title={`Delete layer "${deletingLayer?.name}"?`}
        description="Its pins will be ungrouped, not deleted."
        confirmLabel="Delete"
        danger
        pending={deleteLayer.isPending}
        onConfirm={() => {
          if (deletingLayer) deleteLayer.mutate(deletingLayer.id)
          setDeletingLayer(null)
        }}
        onCancel={() => setDeletingLayer(null)}
      />
    </section>
  )
}
