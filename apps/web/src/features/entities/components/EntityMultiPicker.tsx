import type { EntityType } from '@worldbinder/contracts'
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
  const remove = (entityId: string) => onChange(value.filter((id) => id !== entityId))
  const add = (entityId: string | undefined) => {
    if (entityId && !value.includes(entityId)) onChange([...value, entityId])
  }

  return (
    <div className="wb-field">
      <span className="wb-field__label">{label}</span>
      {value.length > 0 && (
        <div className="wb-entity-multi-picker__chips">
          {value.map((entityId) => (
            <EntityChip
              key={entityId}
              campaignId={campaignId}
              entityId={entityId}
              onRemove={() => remove(entityId)}
            />
          ))}
        </div>
      )}
      <EntityPicker
        campaignId={campaignId}
        label={`Add to ${label.toLowerCase()}`}
        entityType={entityType}
        value={undefined}
        onChange={add}
      />
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
    <span className="wb-entity-picker__chip">
      <span>{entityQuery.data?.name ?? 'Loading…'}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entityQuery.data?.name ?? 'entity'}`}
      >
        ×
      </button>
    </span>
  )
}
