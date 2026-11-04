import type { MapPinSummary } from '@worldbinder/contracts'
import { ErrorState, IconButton, LoadingState } from '@worldbinder/ui'
import { ArrowLeft, Maximize, Minimize, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import '../maps.css'
import { MapViewport, type MapView, type MapViewportHandle } from '../components/MapViewport'
import { PinChooser } from '../components/PinChooser'
import { PinDetails } from '../components/PinDetails'
import { usePlayerMapQuery } from '../hooks/useMaps'

type Chooser = { pins: MapPinSummary[]; anchor: HTMLElement }

/** Router state carried between the workspace and At the Table, so the
 * map stays where it was. Never a selection: nothing chosen in the GM's
 * own view is shown to the players. */
export type MapViewState = { view?: MapView } | null

function useFullscreen() {
  const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  const [active, setActive] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  return { supported, active, toggle }
}

/**
 * At the Table: the map on its own, for a screen the players can see.
 *
 * Everything shown comes from the server's player view of the map
 * (`?audience=players`), whoever is signed in — GM-only layers, pins and
 * pins linked to GM-only entries never reach the page, so they can't be
 * shown by mistake. No navigation, search, edit controls, relationships or
 * article links (those would use the GM's own access). The selection
 * starts empty; only the view (centre and zoom) is carried over, both ways.
 */
export function MapTablePage() {
  const { mapId } = useParams<{ mapId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const location = useLocation()
  const initialView = (location.state as MapViewState)?.view
  const viewportRef = useRef<MapViewportHandle>(null)
  const isPhone = useMediaQuery('(max-width: 768px)')
  const mapQuery = usePlayerMapQuery(campaign.id, mapId)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [chooser, setChooser] = useState<Chooser | null>(null)
  const fullscreen = useFullscreen()
  const workspaceUrl = `/app/campaign/${campaign.id}/maps/${mapId}`

  function exit() {
    if (document.fullscreenElement) void document.exitFullscreen()
    const view = viewportRef.current?.getView()
    navigate(workspaceUrl, { state: { view } satisfies MapViewState })
  }

  // Escape steps back: the chooser, then the selected pin, then the mode.
  const exitRef = useRef(exit)
  exitRef.current = exit
  const stateRef = useRef({ selectedPinId, chooser })
  stateRef.current = { selectedPinId, chooser }
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const { selectedPinId: selected, chooser: open } = stateRef.current
      if (open) return
      if (selected) setSelectedPinId(null)
      else exitRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (mapQuery.isLoading) return <LoadingState label="Loading map…" />
  if (mapQuery.isError || !mapQuery.data) {
    return (
      <div className="wb-table wb-table--message">
        <ErrorState message="This map has no players’ view: it may be GM only, or it couldn’t be loaded." />
        <Link className="wb-button wb-button--secondary" to={workspaceUrl}>
          Back to the map
        </Link>
      </div>
    )
  }
  const map = mapQuery.data
  const selectedPin = map.pins.find((pin) => pin.id === selectedPinId) ?? null

  function closeChooser() {
    const anchor = chooser?.anchor
    setChooser(null)
    if (anchor?.isConnected) anchor.focus()
  }

  return (
    <div className="wb-table">
      <header className="wb-table__bar">
        <button
          type="button"
          className="wb-button wb-button--secondary wb-table__back"
          aria-label="Back to the map"
          onClick={exit}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span aria-hidden="true">Back to the map</span>
        </button>
        <h1 className="wb-table__title">{map.name}</h1>
        <p className="wb-table__safe" role="note">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            Players’ view<span className="wb-table__safe-detail"> · GM-only pins and layers are hidden</span>
          </span>
        </p>
        {fullscreen.supported && (
          <IconButton
            label={fullscreen.active ? 'Leave full screen' : 'Full screen'}
            onClick={fullscreen.toggle}
          >
            {fullscreen.active ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
          </IconButton>
        )}
      </header>

      <div className="wb-table__map">
        <MapViewport
          ref={viewportRef}
          fill
          fitMode={isPhone ? 'cover' : 'contain'}
          initialView={initialView}
          label={`Map: ${map.name} (players’ view)`}
          imageUrl={map.imageUrl}
          imageWidth={map.imageWidth}
          imageHeight={map.imageHeight}
          pins={map.pins}
          manageMode={false}
          selectedPinId={selectedPinId}
          onPinActivate={(pin) => {
            setChooser(null)
            setSelectedPinId(pin.id)
          }}
          onClusterActivate={(pins, anchor) => {
            setSelectedPinId(null)
            setChooser({ pins, anchor })
          }}
          onBackgroundClick={() => {
            setChooser(null)
            setSelectedPinId(null)
          }}
        />

        {(chooser || selectedPin) && (
          <div className="wb-table__panel">
            {chooser ? (
              <PinChooser
                pins={chooser.pins}
                showVisibility={false}
                onChoose={(pin) => {
                  setChooser(null)
                  setSelectedPinId(pin.id)
                }}
                onClose={closeChooser}
              />
            ) : (
              selectedPin && (
                <PinDetails
                  campaignId={campaign.id}
                  pin={selectedPin}
                  layers={map.layers}
                  canEditEntries={false}
                  presentation
                  onClose={() => setSelectedPinId(null)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
