import { Combobox, type ComboboxOption } from '@worldbinder/ui'
import { useState } from 'react'
import { usePlotThreadsQuery } from '../hooks/usePlotThreads'

export interface PlotThreadPickerProps {
  campaignId: string
  label: string
  value: string | undefined
  onChange: (threadId: string | undefined) => void
  placeholder?: string
  error?: string
}

/**
 * Single-select combobox for plot threads, same shape as `EntityPicker`.
 * Filters client-side over the campaign's full thread list rather than a
 * server-side search endpoint — campaigns have far fewer plot threads than
 * entities (perf doc's own "large campaign" figure is 2,000 entities vs.
 * 2,000 threads at the extreme, but typically threads number in the tens),
 * so one list fetch plus local filtering is simpler than adding a search
 * query param for this milestone.
 */
export function PlotThreadPicker({
  campaignId,
  label,
  value,
  onChange,
  placeholder = 'Search plot threads…',
  error,
}: PlotThreadPickerProps) {
  const [query, setQuery] = useState('')
  const threadsQuery = usePlotThreadsQuery(campaignId)

  const selected = threadsQuery.data?.find((thread) => thread.id === value)

  const options: ComboboxOption[] = (threadsQuery.data ?? [])
    .filter(
      (thread) =>
        query.trim().length === 0 ||
        thread.title.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .map((thread) => ({ id: thread.id, label: thread.title, meta: thread.playerFacingStatus }))

  if (value) {
    return (
      <div className="wb-field">
        <span className="wb-field__label">{label}</span>
        <div className="wb-entity-picker__chip">
          <span>{selected?.title ?? 'Loading…'}</span>
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
      loading={threadsQuery.isLoading}
      onSelect={(option) => {
        onChange(option.id)
        setQuery('')
      }}
      placeholder={placeholder}
      error={error}
      emptyMessage="No matching plot threads"
    />
  )
}
