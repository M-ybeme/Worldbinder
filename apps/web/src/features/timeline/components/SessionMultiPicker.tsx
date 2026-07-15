import { Combobox, type ComboboxOption } from '@worldbinder/ui'
import { useState } from 'react'
import { useSessionsQuery } from '../../sessions/hooks/useSessions'

export interface SessionMultiPickerProps {
  campaignId: string
  label: string
  value: string[]
  onChange: (sessionIds: string[]) => void
}

/**
 * Multi-select session picker mirroring EntityMultiPicker's chip+combobox
 * shape exactly (features/entities/components/EntityMultiPicker.tsx) —
 * client-side filtered, since sessions have no dedicated server-side search
 * endpoint and a campaign's session count stays small (roadmap §20.6's perf
 * target is 200 sessions).
 */
export function SessionMultiPicker({
  campaignId,
  label,
  value,
  onChange,
}: SessionMultiPickerProps) {
  const [query, setQuery] = useState('')
  const sessionsQuery = useSessionsQuery(campaignId)

  const remove = (sessionId: string) => onChange(value.filter((id) => id !== sessionId))
  const add = (sessionId: string) => {
    if (!value.includes(sessionId)) onChange([...value, sessionId])
  }

  const sessions = sessionsQuery.data ?? []
  const selected = sessions.filter((s) => value.includes(s.id))
  const matches = sessions.filter(
    (s) => !value.includes(s.id) && s.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const options: ComboboxOption[] = matches.map((s) => ({
    id: s.id,
    label: s.title,
    meta: `Session ${s.sessionNumber}`,
  }))

  return (
    <div className="wb-field">
      <span className="wb-field__label">{label}</span>
      {selected.length > 0 && (
        <div className="wb-entity-multi-picker__chips">
          {selected.map((session) => (
            <span key={session.id} className="wb-entity-picker__chip">
              <span>
                Session {session.sessionNumber}: {session.title}
              </span>
              <button
                type="button"
                onClick={() => remove(session.id)}
                aria-label={`Remove Session ${session.sessionNumber}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Combobox
        label={`Add to ${label.toLowerCase()}`}
        inputValue={query}
        onInputChange={setQuery}
        options={options}
        loading={sessionsQuery.isFetching}
        onSelect={(option) => {
          add(option.id)
          setQuery('')
        }}
        placeholder="Search sessions…"
        emptyMessage={query.trim().length > 0 ? 'No matching sessions' : 'Type to search'}
      />
    </div>
  )
}
