import type { PlotThreadSessionAction } from '@worldbinder/contracts'
import type { PlotThreadChangeInput } from '@worldbinder/validation'
import { Button, Select } from '@worldbinder/ui'
import { useState } from 'react'
import { usePlotThreadsQuery } from '../hooks/usePlotThreads'
import { PlotThreadPicker } from './PlotThreadPicker'

export interface PlotThreadChangesEditorProps {
  campaignId: string
  value: PlotThreadChangeInput[]
  onChange: (changes: PlotThreadChangeInput[]) => void
}

const ACTION_OPTIONS: { value: PlotThreadSessionAction; label: string }[] = [
  { value: 'introduced', label: 'Introduced' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'resolved', label: 'Resolved' },
]

/** Session-side plot-thread linking (roadmap: "Advance or resolve plot
 * threads" is recorded from the session, not the thread — see
 * SessionFormPage). Composes PlotThreadPicker + an action Select, managing
 * an array of {plotThreadId, action}, same list-editing shape as
 * EntityMultiPicker. */
export function PlotThreadChangesEditor({
  campaignId,
  value,
  onChange,
}: PlotThreadChangesEditorProps) {
  const [draftThreadId, setDraftThreadId] = useState<string | undefined>(undefined)
  const [draftAction, setDraftAction] = useState<PlotThreadSessionAction>('advanced')
  const threadsQuery = usePlotThreadsQuery(campaignId)

  const titleFor = (threadId: string): string =>
    threadsQuery.data?.find((thread) => thread.id === threadId)?.title ?? 'Unknown thread'

  function add() {
    if (!draftThreadId) return
    const withoutExisting = value.filter((change) => change.plotThreadId !== draftThreadId)
    onChange([...withoutExisting, { plotThreadId: draftThreadId, action: draftAction }])
    setDraftThreadId(undefined)
    setDraftAction('advanced')
  }

  function remove(plotThreadId: string) {
    onChange(value.filter((change) => change.plotThreadId !== plotThreadId))
  }

  return (
    <div className="wb-field">
      <span className="wb-field__label">Plot thread changes</span>

      {value.length > 0 && (
        <ul className="wb-relationship-list">
          {value.map((change) => (
            <li key={change.plotThreadId}>
              {titleFor(change.plotThreadId)} — {change.action}
              <button
                type="button"
                onClick={() => remove(change.plotThreadId)}
                aria-label={`Remove ${titleFor(change.plotThreadId)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <PlotThreadPicker
        campaignId={campaignId}
        label="Plot thread"
        value={draftThreadId}
        onChange={setDraftThreadId}
      />
      <Select
        id="plotThreadChangeAction"
        label="Action"
        options={ACTION_OPTIONS}
        value={draftAction}
        onChange={(e) => setDraftAction(e.target.value as PlotThreadSessionAction)}
      />
      <Button type="button" variant="secondary" onClick={add} disabled={!draftThreadId}>
        Add
      </Button>
    </div>
  )
}
