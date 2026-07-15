import type { MapPinSummary } from '@worldbinder/contracts'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { AccessiblePinList } from '../components/AccessiblePinList'
import { MapCanvas } from '../components/MapCanvas'
import { MapLayerToggles } from '../components/MapLayerToggles'
import { MapPinForm, type MapPinFormValues } from '../components/MapPinForm'
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
  const [editingPin, setEditingPin] = useState<MapPinSummary | null>(null)
  const [placingPosition, setPlacingPosition] = useState<{ x: number; y: number } | null>(null)
  const [newLayerName, setNewLayerName] = useState('')

  if (mapQuery.isLoading) return <p>Loading…</p>
  if (mapQuery.isError || !mapQuery.data) {
    return <FormMessage message="This map could not be loaded." />
  }
  const map = mapQuery.data

  const visiblePins = map.pins.filter((pin) =>
    pin.layerId ? !hiddenLayerIds.has(pin.layerId) : showUnlayered,
  )

  function handlePinActivate(pin: MapPinSummary) {
    if (manageMode) {
      setPlacingPosition(null)
      setEditingPin(pin)
      return
    }
    // ui-ux.md: selecting a pin opens the linked entity page, not a popup.
    // A freestanding (unlinked) pin has nothing to navigate to in view mode.
    if (pin.locationEntityId) {
      navigate(`/app/campaign/${campaign.id}/world/${pin.locationEntityId}`)
    }
  }

  function handleCanvasPlace(x: number, y: number) {
    setEditingPin(null)
    setPlacingPosition({ x, y })
  }

  function handlePinFormSubmit(values: MapPinFormValues) {
    const { xNormalized, yNormalized, ...rest } = values
    const payload = { ...rest, label: values.label || null }
    if (editingPin) {
      updatePin.mutate(
        { pinId: editingPin.id, input: payload },
        { onSuccess: () => setEditingPin(null) },
      )
      if (xNormalized !== editingPin.xNormalized || yNormalized !== editingPin.yNormalized) {
        repositionPin.mutate({ pinId: editingPin.id, input: { xNormalized, yNormalized } })
      }
    } else {
      createPin.mutate(
        { ...payload, xNormalized, yNormalized },
        { onSuccess: () => setPlacingPosition(null) },
      )
    }
  }

  function handlePinDelete() {
    if (!editingPin) return
    if (!window.confirm('Delete this pin? This cannot be undone.')) return
    deletePin.mutate(editingPin.id, { onSuccess: () => setEditingPin(null) })
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
                setEditingPin(null)
                setPlacingPosition(null)
              }}
            >
              {manageMode ? 'Done editing' : 'Edit map'}
            </Button>
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/maps/${map.id}/edit`}
            >
              Map settings
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                if (!window.confirm(`Delete "${map.name}"? This cannot be undone.`)) return
                deleteMap.mutate(map.id, {
                  onSuccess: () => navigate(`/app/campaign/${campaign.id}/maps`),
                })
              }}
            >
              Delete map
            </Button>
          </div>
        )}
      </header>
      {map.description && <p>{map.description}</p>}
      {manageMode && (
        <p>
          Click the map to place a new pin, or drag an existing pin to move it — the pin form's
          position fields work without a pointer, too.{' '}
          <Button
            variant="secondary"
            onClick={() => {
              setEditingPin(null)
              setPlacingPosition({ x: 0.5, y: 0.5 })
            }}
          >
            + New pin
          </Button>
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

      <MapCanvas
        imageUrl={map.imageUrl}
        imageWidth={map.imageWidth}
        imageHeight={map.imageHeight}
        pins={visiblePins}
        manageMode={manageMode}
        onPinActivate={handlePinActivate}
        onCanvasPlace={manageMode ? handleCanvasPlace : undefined}
        onPinReposition={
          manageMode
            ? (pinId, x, y) =>
                repositionPin.mutate({ pinId, input: { xNormalized: x, yNormalized: y } })
            : undefined
        }
      />

      {(editingPin || placingPosition) && (
        <MapPinForm
          campaignId={campaign.id}
          layers={map.layers}
          pin={editingPin}
          initialPosition={
            editingPin
              ? { x: editingPin.xNormalized, y: editingPin.yNormalized }
              : (placingPosition ?? { x: 0.5, y: 0.5 })
          }
          onSubmit={handlePinFormSubmit}
          onCancel={() => {
            setEditingPin(null)
            setPlacingPosition(null)
          }}
          onDelete={editingPin ? handlePinDelete : undefined}
          isSaving={createPin.isPending || updatePin.isPending || deletePin.isPending}
          error={createPin.error?.message ?? updatePin.error?.message ?? deletePin.error?.message}
        />
      )}

      <AccessiblePinList pins={visiblePins} layers={map.layers} onActivate={handlePinActivate} />

      {canManage && manageMode && (
        <div className="wb-map-layer-manager">
          <h2>Manage layers</h2>
          <ul>
            {map.layers.map((layer) => (
              <li key={layer.id}>
                {layer.name}
                {layer.visibility === 'gm_only' ? ' (GM only)' : ''}
                <Button
                  variant="secondary"
                  disabled={deleteLayer.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete layer "${layer.name}"? Its pins will be ungrouped, not deleted.`,
                      )
                    )
                      return
                    deleteLayer.mutate(layer.id)
                  }}
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
    </section>
  )
}
