import type { MapPinSummary } from '@worldbinder/contracts'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  ErrorState,
  FormMessage,
  IconButton,
  LoadingState,
  MenuButton,
  TextField,
} from '@worldbinder/ui'
import { MoreHorizontal, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import '../maps.css'
import { MapPinPanel } from '../components/MapPinPanel'
import type { MapPinFormValues } from '../components/MapPinForm'
import { MapSwitcher } from '../components/MapSwitcher'
import { MapViewport, type MapViewportHandle } from '../components/MapViewport'
import { PinDetails } from '../components/PinDetails'
import { pinLabel } from '../lib/pins'
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
const PHONE_QUERY = '(max-width: 768px)'
const INSPECTOR_KEY = 'wb.maps.inspector'

function readInspectorPreference(): boolean {
  try {
    return window.localStorage.getItem(INSPECTOR_KEY) !== 'closed'
  } catch {
    return true
  }
}

/**
 * The map workspace: the map fills the content area, with a compact header
 * (map switcher, view/edit, inspector, map actions) and a collapsible
 * inspector beside it (the selected pin, layers, all pins). View mode only
 * selects and reads; edit mode (owners, GMs, editors — the API enforces it)
 * places, drags, edits and removes pins and manages layers.
 */
export function MapDetailPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const viewportRef = useRef<MapViewportHandle>(null)

  const mapQuery = useMapQuery(campaign.id, mapId)
  const deleteMap = useDeleteMapMutation(campaign.id)
  const createLayer = useCreateMapLayerMutation(campaign.id, mapId ?? '')
  const deleteLayer = useDeleteMapLayerMutation(campaign.id, mapId ?? '')
  const createPin = useCreateMapPinMutation(campaign.id, mapId ?? '')
  const updatePin = useUpdateMapPinMutation(campaign.id, mapId ?? '')
  const repositionPin = useRepositionMapPinMutation(campaign.id, mapId ?? '')
  const deletePin = useDeleteMapPinMutation(campaign.id, mapId ?? '')

  const [editing, setEditing] = useState(false)
  const [inspectorPreference, setInspectorPreference] = useState(readInspectorPreference)
  const [inspectorOpenOnPhone, setInspectorOpenOnPhone] = useState(false)
  const inspectorOpen = isPhone ? inspectorOpenOnPhone : inspectorPreference
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set())
  const [showUnlayered, setShowUnlayered] = useState(true)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [editingPin, setEditingPin] = useState(false)
  const [placingPosition, setPlacingPosition] = useState<{ x: number; y: number } | null>(null)
  // Between "Add pin" and the next map click: that click drops the pin.
  const [armedForNewPin, setArmedForNewPin] = useState(false)
  const [newLayerName, setNewLayerName] = useState('')
  const [confirmDeletePin, setConfirmDeletePin] = useState(false)
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false)
  const [deletingLayer, setDeletingLayer] = useState<{ id: string; name: string } | null>(null)

  // A different map: start fresh.
  useEffect(() => {
    setSelectedPinId(null)
    setEditing(false)
    setEditingPin(false)
    setPlacingPosition(null)
    setArmedForNewPin(false)
    setHiddenLayerIds(new Set())
    setShowUnlayered(true)
  }, [mapId])

  function setInspector(open: boolean) {
    if (isPhone) {
      setInspectorOpenOnPhone(open)
      return
    }
    setInspectorPreference(open)
    try {
      window.localStorage.setItem(INSPECTOR_KEY, open ? 'open' : 'closed')
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  if (mapQuery.isLoading) return <LoadingState label="Loading map…" />
  if (mapQuery.isError || !mapQuery.data) {
    return <ErrorState message="This map could not be loaded." onRetry={() => mapQuery.refetch()} />
  }
  const map = mapQuery.data
  const selectedPin = map.pins.find((pin) => pin.id === selectedPinId) ?? null

  const visiblePins = map.pins.filter((pin) =>
    pin.layerId ? !hiddenLayerIds.has(pin.layerId) : showUnlayered,
  )

  function selectPin(pin: MapPinSummary) {
    setArmedForNewPin(false)
    setPlacingPosition(null)
    setEditingPin(editing)
    setSelectedPinId(pin.id)
    setInspector(true)
  }

  function clearSelection() {
    setSelectedPinId(null)
    setEditingPin(false)
    setPlacingPosition(null)
  }

  function setMode(next: boolean) {
    setEditing(next)
    setEditingPin(false)
    setPlacingPosition(null)
    setArmedForNewPin(false)
  }

  function beginPlacingNewPin() {
    setEditing(true)
    setSelectedPinId(null)
    setEditingPin(false)
    setPlacingPosition(null)
    setArmedForNewPin(true)
  }

  function handleCanvasPlace(x: number, y: number) {
    setArmedForNewPin(false)
    setSelectedPinId(null)
    setPlacingPosition({ x, y })
    setInspector(true)
  }

  function handlePinFormSubmit(values: MapPinFormValues) {
    const { xNormalized, yNormalized, ...rest } = values
    const payload = { ...rest, label: values.label || null }
    if (selectedPin) {
      updatePin.mutate({ pinId: selectedPin.id, input: payload }, { onSuccess: () => setEditingPin(false) })
      if (xNormalized !== selectedPin.xNormalized || yNormalized !== selectedPin.yNormalized) {
        repositionPin.mutate({ pinId: selectedPin.id, input: { xNormalized, yNormalized } })
      }
    } else {
      createPin.mutate(
        { ...payload, xNormalized, yNormalized },
        {
          onSuccess: (created) => {
            setPlacingPosition(null)
            setSelectedPinId(created.id)
          },
        },
      )
    }
  }

  const groups = [
    ...map.layers.map((layer) => ({
      key: layer.id,
      name: layer.name,
      gmOnly: layer.visibility === 'gm_only',
      pins: map.pins.filter((pin) => pin.layerId === layer.id),
    })),
    { key: 'none', name: 'No layer', gmOnly: false, pins: map.pins.filter((pin) => !pin.layerId) },
  ].filter((group) => group.pins.length > 0 || group.key !== 'none')

  const mapActions = [
    { label: 'Map settings', onSelect: () => navigate(`/app/campaign/${campaign.id}/maps/${map.id}/edit`) },
    { label: 'Delete map…', onSelect: () => setConfirmDeleteMap(true), danger: true },
  ]

  const showPinForm = editing && (placingPosition !== null || (selectedPin !== null && editingPin))

  return (
    <div className={['wb-mapws', editing ? 'wb-mapws--editing' : ''].filter(Boolean).join(' ')}>
      <header className="wb-mapws__header">
        <nav className="wb-mapws__crumbs" aria-label="Breadcrumb">
          <Link to={`/app/campaign/${campaign.id}/maps`}>Maps</Link>
          <span aria-hidden="true">›</span>
        </nav>
        <MapSwitcher campaignId={campaign.id} mapId={map.id} mapName={map.name} />
        {map.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
        <div className="wb-mapws__spacer" />
        {canManage && (
          <div className="wb-mapws__mode" role="group" aria-label="Mode">
            <button type="button" aria-pressed={!editing} onClick={() => setMode(false)}>
              View
            </button>
            <button type="button" aria-pressed={editing} onClick={() => setMode(true)}>
              Edit
            </button>
          </div>
        )}
        {canManage && editing && (
          <Button className="wb-mapws__add" onClick={beginPlacingNewPin} disabled={!map.imageUrl}>
            <Plus size={16} aria-hidden="true" /> Add pin
          </Button>
        )}
        <IconButton
          label={inspectorOpen ? 'Hide pins panel' : 'Show pins panel'}
          aria-expanded={inspectorOpen}
          aria-controls="map-inspector"
          onClick={() => setInspector(!inspectorOpen)}
        >
          {inspectorOpen ? (
            <PanelRightClose size={18} aria-hidden="true" />
          ) : (
            <PanelRightOpen size={18} aria-hidden="true" />
          )}
        </IconButton>
        {canManage && (
          <MenuButton
            label={<MoreHorizontal size={18} aria-hidden="true" />}
            ariaLabel="Map actions"
            menuLabel="Map actions"
            buttonClassName="wb-icon-button"
            items={mapActions}
          />
        )}
      </header>

      {editing && armedForNewPin && (
        <div className="wb-mapws__banner" role="status">
          <span>
            <strong>Placing a pin:</strong> click the map where it goes.
          </span>
          <Button variant="secondary" onClick={() => handleCanvasPlace(0.5, 0.5)}>
            Place at the centre
          </Button>
          <Button variant="secondary" onClick={() => setArmedForNewPin(false)}>
            Cancel
          </Button>
        </div>
      )}
      {editing && !armedForNewPin && (
        <div className="wb-mapws__banner wb-mapws__banner--quiet" role="status">
          <span>Editing: drag a pin to move it, or select one to change it.</span>
        </div>
      )}

      <div className="wb-mapws__body">
        <div className="wb-mapws__map">
          <MapViewport
            ref={viewportRef}
            fill
            fitMode={isPhone ? 'cover' : 'contain'}
            label={`Map: ${map.name}`}
            imageUrl={map.imageUrl}
            imageWidth={map.imageWidth}
            imageHeight={map.imageHeight}
            pins={visiblePins}
            manageMode={editing}
            selectedPinId={selectedPinId}
            onPinActivate={selectPin}
            onBackgroundClick={clearSelection}
            onEscape={clearSelection}
            onCanvasPlace={editing && armedForNewPin ? handleCanvasPlace : undefined}
            onPinReposition={
              editing
                ? (pinId, x, y) => repositionPin.mutate({ pinId, input: { xNormalized: x, yNormalized: y } })
                : undefined
            }
          />
        </div>

        {inspectorOpen && (
          <aside id="map-inspector" className="wb-mapws__inspector" aria-label="Pins panel">
            {showPinForm ? (
              <MapPinPanel
                campaignId={campaign.id}
                layers={map.layers}
                canManage={canManage}
                pin={placingPosition ? null : selectedPin}
                initialPosition={
                  selectedPin && !placingPosition
                    ? { x: selectedPin.xNormalized, y: selectedPin.yNormalized }
                    : (placingPosition ?? { x: 0.5, y: 0.5 })
                }
                onSubmit={handlePinFormSubmit}
                onClose={() => {
                  setEditingPin(false)
                  setPlacingPosition(null)
                }}
                onDelete={selectedPin && !placingPosition ? () => setConfirmDeletePin(true) : undefined}
                isSaving={createPin.isPending || updatePin.isPending || deletePin.isPending}
                error={createPin.error?.message ?? updatePin.error?.message ?? deletePin.error?.message}
              />
            ) : selectedPin ? (
              <PinDetails
                campaignId={campaign.id}
                pin={selectedPin}
                layers={map.layers}
                canEditEntries={canManage}
                onClose={clearSelection}
                onEditPin={editing ? () => setEditingPin(true) : undefined}
              />
            ) : (
              map.description && <p className="wb-mapws__description">{map.description}</p>
            )}

            {(map.layers.length > 0 || editing) && (
              <section className="wb-mapws__section" aria-labelledby="map-layers-title">
                <h2 id="map-layers-title" className="wb-mapws__eyebrow">
                  Layers
                </h2>
                <ul className="wb-mapws__layers">
                  {map.layers.map((layer) => (
                    <li key={layer.id}>
                      <Checkbox
                        checked={!hiddenLayerIds.has(layer.id)}
                        onChange={() =>
                          setHiddenLayerIds((previous) => {
                            const next = new Set(previous)
                            if (next.has(layer.id)) next.delete(layer.id)
                            else next.add(layer.id)
                            return next
                          })
                        }
                        label={layer.name}
                      />
                      {layer.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
                      {editing && (
                        <Button
                          variant="secondary"
                          className="wb-mapws__small"
                          disabled={deleteLayer.isPending}
                          aria-label={`Delete layer ${layer.name}`}
                          onClick={() => setDeletingLayer({ id: layer.id, name: layer.name })}
                        >
                          Delete
                        </Button>
                      )}
                    </li>
                  ))}
                  {map.pins.some((pin) => !pin.layerId) && (
                    <li>
                      <Checkbox
                        checked={showUnlayered}
                        onChange={() => setShowUnlayered((value) => !value)}
                        label="Pins without a layer"
                      />
                    </li>
                  )}
                </ul>
                {editing && (
                  <form
                    className="wb-mapws__new-layer"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!newLayerName.trim()) return
                      createLayer.mutate({ name: newLayerName }, { onSuccess: () => setNewLayerName('') })
                    }}
                    noValidate
                  >
                    <TextField
                      id="new-layer-name"
                      label="New layer"
                      value={newLayerName}
                      onChange={(event) => setNewLayerName(event.target.value)}
                    />
                    <Button type="submit" variant="secondary" disabled={createLayer.isPending}>
                      Add layer
                    </Button>
                    <FormMessage message={createLayer.error?.message ?? deleteLayer.error?.message} tone="error" />
                  </form>
                )}
              </section>
            )}

            <section className="wb-mapws__section" aria-labelledby="map-pins-title">
              <h2 id="map-pins-title" className="wb-mapws__eyebrow">
                Pins <span className="wb-mapws__count">{map.pins.length}</span>
              </h2>
              {map.pins.length === 0 && (
                <p className="wb-mapws__muted">
                  {canManage ? 'No pins yet. Switch to Edit and choose Add pin.' : 'No pins on this map yet.'}
                </p>
              )}
              {groups.map(
                (group) =>
                  group.pins.length > 0 && (
                    <div key={group.key} className="wb-mapws__group">
                      <h3 className="wb-mapws__group-title">
                        {group.name}
                        {group.gmOnly && <Badge tone="warning">GM only</Badge>}
                      </h3>
                      <ul className="wb-mapws__pins">
                        {group.pins.map((pin) => (
                          <li key={pin.id}>
                            <button
                              type="button"
                              className="wb-mapws__pin-row"
                              aria-current={pin.id === selectedPinId || undefined}
                              onClick={() => {
                                selectPin(pin)
                                viewportRef.current?.centerOn(pin.xNormalized, pin.yNormalized)
                              }}
                            >
                              <span className="wb-mapws__pin-name">{pinLabel(pin)}</span>
                              <span className="wb-mapws__muted">
                                {pin.locationEntityType ?? 'pin'}
                                {pin.visibility === 'gm_only' && ' · GM only'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </section>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeletePin}
        title="Delete this pin?"
        description="The pin is removed from the map. Its linked entry isn't affected. This can't be undone."
        confirmLabel="Delete pin"
        danger
        pending={deletePin.isPending}
        onConfirm={() => {
          setConfirmDeletePin(false)
          if (selectedPin) deletePin.mutate(selectedPin.id, { onSuccess: clearSelection })
        }}
        onCancel={() => setConfirmDeletePin(false)}
      />

      <ConfirmDialog
        open={confirmDeleteMap}
        title={`Delete "${map.name}"?`}
        description="The map, its layers and all its pins are deleted. Linked entries aren't affected. This can't be undone."
        confirmLabel="Delete map"
        danger
        pending={deleteMap.isPending}
        onConfirm={() => {
          setConfirmDeleteMap(false)
          deleteMap.mutate(map.id, { onSuccess: () => navigate(`/app/campaign/${campaign.id}/maps`) })
        }}
        onCancel={() => setConfirmDeleteMap(false)}
      />

      <ConfirmDialog
        open={deletingLayer !== null}
        title={`Delete layer "${deletingLayer?.name}"?`}
        description="Its pins stay on the map, without a layer."
        confirmLabel="Delete layer"
        danger
        pending={deleteLayer.isPending}
        onConfirm={() => {
          if (deletingLayer) deleteLayer.mutate(deletingLayer.id)
          setDeletingLayer(null)
        }}
        onCancel={() => setDeletingLayer(null)}
      />
    </div>
  )
}
