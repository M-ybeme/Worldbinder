import type { EntityType } from '@worldbinder/contracts'
import { ENTITY_TYPE_LABELS, ENTITY_TYPES, EntityTypeIcon } from '../lib/entityTypeIcons'
import '../entities.css'

export interface EntityTypePickerProps {
  value: EntityType
  onChange: (type: EntityType) => void
}

/**
 * Icon+label button grid for the quick-create dialog's type selection —
 * a native <select> can't render an icon per <option> in any browser, and
 * this is a closed 11-option set, which suits a button grid better than a
 * dropdown anyway.
 */
export function EntityTypePicker({ value, onChange }: EntityTypePickerProps) {
  return (
    <div className="wb-entity-type-picker" role="group" aria-label="Entity type">
      {ENTITY_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="wb-entity-type-picker__option"
          aria-pressed={value === type}
          onClick={() => onChange(type)}
        >
          <EntityTypeIcon type={type} />
          {ENTITY_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
