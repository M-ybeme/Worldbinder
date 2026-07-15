import type { EntityType } from '@worldbinder/contracts'
import { useState } from 'react'
import { useEntityQuery } from '../hooks/useEntities'
import { EntityPicker } from './EntityPicker'

export interface EntityMultiPickerProps {
  campaignId: string
  label: string
  value: string[]
  onChange: (entityIds: string[]) => void
  entityType?: EntityType
}

/**
 * Multi-select wrapper around EntityPicker: a chip per selected entity plus
 * one picker for adding another. Used for a session's featured entities and
 * locations.
 */
export function EntityMultiPicker({
  campaignId,
  label,
  value,
  onChange,
  entityType,
}: EntityMultiPickerProps) {
  const [announcement, setAnnouncement] = useState('')
  const remove = (entityId: string) => {
    onChange(value.filter((id) => id !== entityId))
    setAnnouncement(`Removed from ${label.toLowerCase()}`)
  }
  const add = (entityId: string | undefined) => {
    if (entityId && !value.includes(entityId)) {
      onChange([...value, entityId])
      setAnnouncement(`Added to ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="wb-field">
      <span className="wb-field__label">{label}</span>
      {value.length > 0 && (
        <ul className="wb-entity-multi-picker__chips" role="list">
          {value.map((entityId) => (
            <EntityChip
              key={entityId}
              campaignId={campaignId}
              entityId={entityId}
              onRemove={() => remove(entityId)}
            />
          ))}
        </ul>
      )}
      <EntityPicker
        campaignId={campaignId}
        label={`Add to ${label.toLowerCase()}`}
        entityType={entityType}
        value={undefined}
        onChange={add}
      />
      <span className="wb-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

function EntityChip({
  campaignId,
  entityId,
  onRemove,
}: {
  campaignId: string
  entityId: string
  onRemove: () => void
}) {
  const entityQuery = useEntityQuery(campaignId, entityId)
  return (
    <li className="wb-entity-picker__chip">
      <span>{entityQuery.data?.name ?? 'Loading…'}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entityQuery.data?.name ?? 'entity'}`}
      >
        ×
      </button>
    </li>
  )
}
