import type { EntityVisibility, MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { Button, FormMessage, Select, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { EntityPicker } from '../../entities/components/EntityPicker'

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
}

export interface MapPinFormProps {
  campaignId: string
  layers: MapLayerSummary[]
  /** Present when editing an existing pin; absent when placing a new one. */
  pin?: MapPinSummary | null
  /** Starting position (0–1 normalized) — the pin's own position when
   * editing, or the clicked/default position when placing a new one. */
  initialPosition: { x: number; y: number }
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
}: MapPinFormProps) {
  const [label, setLabel] = useState(pin?.label ?? '')
  const [locationEntityId, setLocationEntityId] = useState<string | undefined>(
    pin?.locationEntityId ?? undefined,
  )
  const [layerId, setLayerId] = useState(pin?.layerId ?? NO_LAYER)
  const [visibility, setVisibility] = useState<EntityVisibility>(pin?.visibility ?? 'public')
  const [xPercent, setXPercent] = useState(String(Math.round(initialPosition.x * 100)))
  const [yPercent, setYPercent] = useState(String(Math.round(initialPosition.y * 100)))

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
          xNormalized: clampPercent(Number(xPercent) || 0) / 100,
          yNormalized: clampPercent(Number(yPercent) || 0) / 100,
        })
      }}
      noValidate
    >
      <h3>{pin ? 'Edit pin' : 'New pin'}</h3>
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
        label="Visibility"
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
        onChange={(e) => setXPercent(e.target.value)}
      />
      <TextField
        id="pin-y"
        label="Position — top (%)"
        type="number"
        min={0}
        max={100}
        value={yPercent}
        onChange={(e) => setYPercent(e.target.value)}
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
