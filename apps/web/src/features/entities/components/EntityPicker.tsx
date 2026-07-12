import type { EntityType } from '@worldbinder/contracts'
import { Combobox, type ComboboxOption } from '@worldbinder/ui'
import { useEffect, useState } from 'react'
import { useEntitiesQuery, useEntityQuery } from '../hooks/useEntities'

export interface EntityPickerProps {
  campaignId: string
  label: string
  value: string | undefined
  onChange: (entityId: string | undefined) => void
  entityType?: EntityType
  placeholder?: string
  error?: string
}

/**
 * Debounced entity search-and-select, backed by the same server-side name
 * search the World list filter uses. Selecting an entity shows it as a
 * chip; the search input only reappears if the selection is cleared.
 */
export function EntityPicker({
  campaignId,
  label,
  value,
  onChange,
  entityType,
  placeholder = 'Search entities…',
  error,
}: EntityPickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(handle)
  }, [query])

  const searchResults = useEntitiesQuery(
    campaignId,
    { search: debouncedQuery, entityType },
    { enabled: debouncedQuery.trim().length > 0 },
  )

  // Resolve a pre-existing selection's display name (e.g. an entity loaded
  // from a saved metadata reference) without needing it in search results.
  const selectedEntityQuery = useEntityQuery(campaignId, value)

  const options: ComboboxOption[] = (searchResults.data ?? []).map((entity) => ({
    id: entity.id,
    label: entity.name,
    meta: entity.entityType,
  }))

  if (value) {
    return (
      <div className="wb-field">
        <span className="wb-field__label">{label}</span>
        <div className="wb-entity-picker__chip">
          <span>{selectedEntityQuery.data?.name ?? 'Loading…'}</span>
          <button type="button" onClick={() => onChange(undefined)} aria-label={`Clear ${label}`}>
            ×
          </button>
        </div>
        {error && (
          <p className="wb-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Combobox
      label={label}
      inputValue={query}
      onInputChange={setQuery}
      options={options}
      loading={searchResults.isFetching}
      onSelect={(option) => {
        onChange(option.id)
        setQuery('')
      }}
      placeholder={placeholder}
      error={error}
      emptyMessage={debouncedQuery.trim().length > 0 ? 'No matching entities' : 'Type to search'}
    />
  )
}
