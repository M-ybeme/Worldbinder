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
import { ChevronDown, ChevronUp, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import '../maps.css'
import { MapPinPanel } from '../components/MapPinPanel'
import type { MapPinFormValues } from '../components/MapPinForm'
import { MapSwitcher } from '../components/MapSwitcher'
import { MapViewport, type MapViewportHandle } from '../components/MapViewport'
import { PinBrowser } from '../components/PinBrowser'
import { PinChooser } from '../components/PinChooser'
import { PinDetails } from '../components/PinDetails'
import { matchesFilter, NO_FILTER, type PinFilter } from '../lib/pins'
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
// Arrow-key nudges are saved once the keys go quiet, not on every press.
const NUDGE_SAVE_DELAY_MS = 400

function readInspectorPreference(): boolean {
  try {
    return window.localStorage.getItem(INSPECTOR_KEY) !== 'closed'
  } catch {
    return true
  }
}

type Chooser = { pins: MapPinSummary[]; anchor: HTMLElement }
type PendingNudge = { timer: number; save: () => void }

/**
 * The map workspace: the map fills the content area, with a compact header
 * (map switcher, view/edit, add pin, panel toggle, map actions) and an
 * inspector beside it — or, on phones, a bottom sheet over it — holding the
 * selected pin, layers and a searchable list of pins.
 *
 * View mode only selects and reads. Edit mode (owners, GMs, editors; the
 * API enforces it) places, drags, nudges, edits and removes pins and
 * manages layers. A pin form with unsaved changes is never dropped
 * silently: leaving the page, choosing another pin, switching modes or
 * closing the form asks first.
 */
export function MapDetailPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const viewportRef = useRef<MapViewportHandle>(null)
  const mapAreaRef = useRef<HTMLDivElement>(null)

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
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set())
  const [showUnlayered, setShowUnlayered] = useState(true)
  const [filter, setFilter] = useState<PinFilter>(NO_FILTER)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [editingPin, setEditingPin] = useState(false)
  const [placingPosition, setPlacingPosition] = useState<{ x: number; y: number } | null>(null)
  // Between "Add pin" and the next map click: that click drops the pin.
  const [armedForNewPin, setArmedForNewPin] = useState(false)
  const [chooser, setChooser] = useState<Chooser | null>(null)
  const [nudged, setNudged] = useState<Record<string, { x: number; y: number }>>({})
  const pendingNudges = useRef<Record<string, PendingNudge>>({})
  const [formDirty, setFormDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [newLayerName, setNewLayerName] = useState('')
  const [confirmDeletePin, setConfirmDeletePin] = useState(false)
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false)
  const [deletingLayer, setDeletingLayer] = useState<{ id: string; name: string } | null>(null)

  // Leaving the page with an unsaved pin form: ask first (in-app links,
  // Back/Forward, the map switcher), and warn on closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => formDirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!formDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [formDirty])

  // A different map: start fresh.
  useEffect(() => {
    setSelectedPinId(null)
    setEditing(false)
    setEditingPin(false)
    setPlacingPosition(null)
    setArmedForNewPin(false)
    setHiddenLayerIds(new Set())
    setShowUnlayered(true)
    setFilter(NO_FILTER)
    setChooser(null)
  }, [mapId])

  // Nudges still waiting to be saved are saved now, not lost, when the
  // page goes away.
  useEffect(() => {
    const pending = pendingNudges.current
    return () => {
      for (const nudge of Object.values(pending)) {
        window.clearTimeout(nudge.timer)
        nudge.save()
      }
    }
  }, [])

  if (mapQuery.isLoading) return <LoadingState label="Loading map…" />
  if (mapQuery.isError || !mapQuery.data) {
    return <ErrorState message="This map could not be loaded." onRetry={() => mapQuery.refetch()} />
  }
  const map = mapQuery.data
  const layerName = new Map(map.layers.map((layer) => [layer.id, layer.name]))
  const pins = map.pins.map((pin) => {
    const override = nudged[pin.id]
    return override ? { ...pin, xNormalized: override.x, yNormalized: override.y } : pin
  })
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null
  // Phones always have the sheet (collapsed to a handle, or expanded).
  const inspectorOpen = isPhone || inspectorPreference

  const visiblePins = pins.filter(
    (pin) =>
      (pin.layerId ? !hiddenLayerIds.has(pin.layerId) : showUnlayered) &&
      matchesFilter(pin, filter, pin.layerId ? layerName.get(pin.layerId) : undefined),
  )

  /** Runs `action` now, or once the user agrees to drop unsaved pin
   * changes. */
  function guarded(action: () => void) {
    if (formDirty) setPendingAction(() => action)
    else action()
  }

  function setInspector(open: boolean) {
    if (isPhone) {
      setSheetExpanded(open)
      return
    }
    setInspectorPreference(open)
    try {
      window.localStorage.setItem(INSPECTOR_KEY, open ? 'open' : 'closed')
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  function selectPin(pin: MapPinSummary, locate = false) {
    guarded(() => {
      setChooser(null)
      setArmedForNewPin(false)
      setPlacingPosition(null)
      setEditingPin(editing)
      setSelectedPinId(pin.id)
      setInspector(true)
      if (locate) viewportRef.current?.centerOn(pin.xNormalized, pin.yNormalized, 1.5)
    })
  }

  function clearSelection() {
    guarded(() => {
      setSelectedPinId(null)
      setEditingPin(false)
      setPlacingPosition(null)
      setChooser(null)
    })
  }

  function setMode(next: boolean) {
    guarded(() => {
      setEditing(next)
      setEditingPin(false)
      setPlacingPosition(null)
      setArmedForNewPin(false)
    })
  }

  function beginPlacingNewPin() {
    guarded(() => {
      setEditing(true)
      setSelectedPinId(null)
      setEditingPin(false)
      setPlacingPosition(null)
      setArmedForNewPin(true)
      if (isPhone) setSheetExpanded(false)
    })
  }

  function handleCanvasPlace(x: number, y: number) {
    setArmedForNewPin(false)
    setSelectedPinId(null)
    setPlacingPosition({ x, y })
    setInspector(true)
  }

  function nudgePin(pin: MapPinSummary, dx: number, dy: number) {
    const x = Math.min(1, Math.max(0, pin.xNormalized + dx))
    const y = Math.min(1, Math.max(0, pin.yNormalized + dy))
    setNudged((current) => ({ ...current, [pin.id]: { x, y } }))
    const previous = pendingNudges.current[pin.id]
    if (previous) window.clearTimeout(previous.timer)
    const save = () => {
      delete pendingNudges.current[pin.id]
      repositionPin.mutate(
        { pinId: pin.id, input: { xNormalized: x, yNormalized: y } },
        {
          // The refetched map carries the saved position; drop the local
          // one unless another nudge has started since.
          onSettled: () =>
            setNudged((current) => {
              if (pendingNudges.current[pin.id]) return current
              const rest = { ...current }
              delete rest[pin.id]
              return rest
            }),
        },
      )
    }
    pendingNudges.current[pin.id] = { timer: window.setTimeout(save, NUDGE_SAVE_DELAY_MS), save }
  }

  function handlePinFormSubmit(values: MapPinFormValues) {
    const { xNormalized, yNormalized, positionChanged, ...rest } = values
    const payload = { ...rest, label: values.label || null }
    if (selectedPin && !placingPosition) {
      updatePin.mutate(
        { pinId: selectedPin.id, input: payload },
        {
          onSuccess: () => {
            setFormDirty(false)
            setEditingPin(false)
          },
        },
      )
      if (positionChanged) repositionPin.mutate({ pinId: selectedPin.id, input: { xNormalized, yNormalized } })
    } else {
      createPin.mutate(
        { ...payload, xNormalized, yNormalized },
        {
          onSuccess: (created) => {
            setFormDirty(false)
            setPlacingPosition(null)
            setSelectedPinId(created.id)
          },
        },
      )
    }
  }

  function closeChooser(returnFocus: boolean) {
    const anchor = chooser?.anchor
    setChooser(null)
    if (returnFocus && anchor?.isConnected) anchor.focus()
  }

  // Desktop: the chooser floats beside the group's marker, inside the map.
  let chooserStyle: CSSProperties | undefined
  if (chooser && !isPhone && mapAreaRef.current) {
    const area = mapAreaRef.current.getBoundingClientRect()
    const anchor = chooser.anchor.getBoundingClientRect()
    const left = Math.min(anchor.right + 8 - area.left, area.width - 288)
    const top = Math.min(anchor.top - area.top - 20, area.height - 72 - chooser.pins.length * 44)
    chooserStyle = { left: Math.max(8, left), top: Math.max(8, top) }
  }

  const mapActions = [
    { label: 'Map settings', onSelect: () => navigate(`/app/campaign/${campaign.id}/maps/${map.id}/edit`) },
    { label: 'Delete map…', onSelect: () => setConfirmDeleteMap(true), danger: true },
  ]

  const showPinForm = editing && (placingPosition !== null || (selectedPin !== null && editingPin))
  const showBrowse = !isPhone || sheetExpanded

  const pinDetail = showPinForm ? (
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
      onClose={() =>
        guarded(() => {
          setEditingPin(false)
          setPlacingPosition(null)
        })
      }
      onDelete={selectedPin && !placingPosition ? () => setConfirmDeletePin(true) : undefined}
      isSaving={createPin.isPending || updatePin.isPending || deletePin.isPending}
      error={createPin.error?.message ?? updatePin.error?.message ?? deletePin.error?.message}
      onDirtyChange={setFormDirty}
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
  ) : null

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
        {!isPhone && (
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
        )}
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
            <strong>Placing a pin:</strong> {isPhone ? 'tap' : 'click'} the map where it goes.
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
          <span>Editing: drag a pin (or focus it and use the arrow keys) to move it; select one to change it.</span>
        </div>
      )}

      <div className="wb-mapws__body">
        <div className="wb-mapws__map" ref={mapAreaRef}>
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
            onPinActivate={(pin) => selectPin(pin)}
            onBackgroundClick={() => {
              if (chooser) setChooser(null)
              else if (selectedPinId && !showPinForm) clearSelection()
            }}
            onEscape={() => {
              if (!showPinForm) clearSelection()
            }}
            onClusterActivate={(groupPins, anchor) => {
              setChooser({ pins: groupPins, anchor })
              if (isPhone) setSheetExpanded(false)
            }}
            onCanvasPlace={editing && armedForNewPin ? handleCanvasPlace : undefined}
            onPinReposition={
              editing
                ? (pinId, x, y) => repositionPin.mutate({ pinId, input: { xNormalized: x, yNormalized: y } })
                : undefined
            }
            onPinNudge={editing ? nudgePin : undefined}
          />
          {chooser && !isPhone && (
            <PinChooser
              pins={chooser.pins}
              style={chooserStyle}
              onChoose={(pin) => selectPin(pin)}
              onClose={() => closeChooser(true)}
            />
          )}
        </div>

        {inspectorOpen && (
          <aside
            id="map-inspector"
            className={[
              'wb-mapws__inspector',
              isPhone ? 'wb-mapws__inspector--sheet' : '',
              isPhone && (sheetExpanded || chooser) ? 'wb-mapws__inspector--expanded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Pins panel"
          >
            {isPhone && (
              <button
                type="button"
                className="wb-mapws__sheet-handle"
                aria-expanded={sheetExpanded}
                onClick={() => {
                  setChooser(null)
                  setSheetExpanded((value) => !value)
                }}
              >
                <span className="wb-mapws__sheet-grip" aria-hidden="true" />
                <span className="wb-mapws__sheet-label">
                  {sheetExpanded
                    ? 'Show the map'
                    : selectedPin
                      ? selectedPin.label ?? selectedPin.locationEntityName ?? 'Selected pin'
                      : `Pins (${map.pins.length})`}
                </span>
                {sheetExpanded ? (
                  <ChevronDown size={16} aria-hidden="true" />
                ) : (
                  <ChevronUp size={16} aria-hidden="true" />
                )}
              </button>
            )}
            {chooser && isPhone && (
              <PinChooser pins={chooser.pins} onChoose={(pin) => selectPin(pin)} onClose={() => closeChooser(true)} />
            )}

            {showBrowse && pinDetail}
            {showBrowse && !pinDetail && map.description && (
              <p className="wb-mapws__description">{map.description}</p>
            )}

            {showBrowse && (map.layers.length > 0 || editing) && (
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

            {showBrowse &&
              (map.pins.length === 0 ? (
                <p className="wb-mapws__muted">
                  {canManage ? 'No pins yet. Switch to Edit and choose Add pin.' : 'No pins on this map yet.'}
                </p>
              ) : (
                <PinBrowser
                  pins={pins}
                  layers={map.layers}
                  hiddenLayerIds={hiddenLayerIds}
                  showUnlayered={showUnlayered}
                  filter={filter}
                  onFilterChange={setFilter}
                  selectedPinId={selectedPinId}
                  onSelect={(pin) => selectPin(pin, true)}
                />
              ))}
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null || blocker.state === 'blocked'}
        title="Discard your changes to this pin?"
        description="They haven't been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          const action = pendingAction
          setPendingAction(null)
          setFormDirty(false)
          setEditingPin(false)
          setPlacingPosition(null)
          if (blocker.state === 'blocked') blocker.proceed()
          action?.()
        }}
        onCancel={() => {
          setPendingAction(null)
          if (blocker.state === 'blocked') blocker.reset()
        }}
      />

      <ConfirmDialog
        open={confirmDeletePin}
        title="Delete this pin?"
        description="The pin is removed from the map. Its linked entry isn't affected. This can't be undone."
        confirmLabel="Delete pin"
        danger
        pending={deletePin.isPending}
        onConfirm={() => {
          setConfirmDeletePin(false)
          if (selectedPin)
            deletePin.mutate(selectedPin.id, {
              onSuccess: () => {
                setFormDirty(false)
                setSelectedPinId(null)
                setEditingPin(false)
              },
            })
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
