import type { EntityVisibility, MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { Button, FormMessage, Select, TextField } from '@worldbinder/ui'
import { useEffect, useRef, useState } from 'react'
import { EntityPicker } from '../../entities/components/EntityPicker'
import '../maps.css'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

export interface MapPinFormValues {
  label: string
  locationEntityId: string | undefined
  layerId: string | undefined
  visibility: EntityVisibility
  xNormalized: number
  yNormalized: number
  /** The position fields were edited (otherwise the pin stays exactly
   * where it is — the fields show a rounded copy). */
  positionChanged: boolean
}

export interface MapPinFormProps {
  campaignId: string
  layers: MapLayerSummary[]
  /** Present when editing an existing pin; absent when placing a new one. */
  pin?: MapPinSummary | null
  /** Position (0–1 normalized) — the pin's own position when editing, or
   * the clicked/default position when placing a new one. Followed while
   * the form is open (a drag or arrow-key nudge updates the fields) unless
   * the position fields themselves have been edited. */
  initialPosition: { x: number; y: number }
  /** Whether the form holds changes that haven't been saved. */
  onDirtyChange?: (dirty: boolean) => void
  onSubmit: (values: MapPinFormValues) => void
  onCancel: () => void
  onDelete?: () => void
  isSaving: boolean
  error?: string | null
}

const NO_LAYER = ''

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

const percent = (value: number) => String(Math.round(value * 1000) / 10)

/** Inline form (no modal primitive exists in this codebase yet — see
 * RevisionHistoryPanel's precedent) used both for placing a new pin
 * (clicked position pre-filled by the caller) and editing an existing one.
 * Position fields are the keyboard equivalent of dragging a pin on the
 * canvas — dragging has no keyboard analog otherwise. */
export function MapPinForm({
  campaignId,
  layers,
  pin,
  initialPosition,
  onSubmit,
  onCancel,
  onDelete,
  isSaving,
  error,
  onDirtyChange,
}: MapPinFormProps) {
  const [label, setLabel] = useState(pin?.label ?? '')
  const [locationEntityId, setLocationEntityId] = useState<string | undefined>(
    pin?.locationEntityId ?? undefined,
  )
  const [layerId, setLayerId] = useState(pin?.layerId ?? NO_LAYER)
  const [visibility, setVisibility] = useState<EntityVisibility>(pin?.visibility ?? 'public')
  const [xPercent, setXPercent] = useState(percent(initialPosition.x))
  const [yPercent, setYPercent] = useState(percent(initialPosition.y))
  const [positionTouched, setPositionTouched] = useState(false)

  // A drag or nudge while the form is open: show where the pin now is
  // (so saving doesn't move it back) — unless the fields were typed in.
  useEffect(() => {
    if (positionTouched) return
    setXPercent(percent(initialPosition.x))
    setYPercent(percent(initialPosition.y))
  }, [initialPosition.x, initialPosition.y, positionTouched])

  const initial = useRef({
    label: pin?.label ?? '',
    locationEntityId: pin?.locationEntityId ?? undefined,
    layerId: pin?.layerId ?? NO_LAYER,
    visibility: pin?.visibility ?? 'public',
  })
  // A new pin is unsaved work as soon as it's placed.
  const dirty =
    !pin ||
    positionTouched ||
    label !== initial.current.label ||
    locationEntityId !== initial.current.locationEntityId ||
    layerId !== initial.current.layerId ||
    visibility !== initial.current.visibility
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty)
  }, [dirty])
  useEffect(() => () => onDirtyChangeRef.current?.(false), [])

  const layerOptions = [
    { value: NO_LAYER, label: 'No layer' },
    ...layers.map((layer) => ({ value: layer.id, label: layer.name })),
  ]

  return (
    <form
      className="wb-form wb-map-pin-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          label,
          locationEntityId,
          layerId: layerId === NO_LAYER ? undefined : layerId,
          visibility,
          xNormalized: positionTouched ? clampPercent(Number(xPercent) || 0) / 100 : initialPosition.x,
          yNormalized: positionTouched ? clampPercent(Number(yPercent) || 0) / 100 : initialPosition.y,
          positionChanged: positionTouched,
        })
      }}
      noValidate
    >
      <h3>{pin ? 'Edit pin' : 'New pin'}</h3>
      <p className="wb-map-pin-form__hint">
        {pin
          ? 'Drag the pin on the map, or focus it and use the arrow keys, to move it.'
          : 'Placed where you clicked. You can fine-tune the position below.'}
      </p>
      <TextField
        id="pin-label"
        label="Label (optional if linked to an entity)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <EntityPicker
        campaignId={campaignId}
        label="Linked entity (optional)"
        value={locationEntityId}
        onChange={setLocationEntityId}
      />
      <Select
        id="pin-layer"
        label="Layer"
        options={layerOptions}
        value={layerId}
        onChange={(e) => setLayerId(e.target.value)}
      />
      <Select
        id="pin-visibility"
        label="Who can see it"
        options={VISIBILITY_OPTIONS}
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
      />
      <TextField
        id="pin-x"
        label="Position — left (%)"
        type="number"
        min={0}
        max={100}
        value={xPercent}
        step={0.1}
        onChange={(e) => {
          setPositionTouched(true)
          setXPercent(e.target.value)
        }}
      />
      <TextField
        id="pin-y"
        label="Position — top (%)"
        type="number"
        min={0}
        max={100}
        value={yPercent}
        step={0.1}
        onChange={(e) => {
          setPositionTouched(true)
          setYPercent(e.target.value)
        }}
      />

      <FormMessage message={error} tone="error" />
      <div className="wb-entity-header__actions">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save pin'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <Button type="button" variant="secondary" onClick={onDelete} disabled={isSaving}>
            Delete pin
          </Button>
        )}
      </div>
    </form>
  )
}
