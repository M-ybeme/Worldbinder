import type { CalendarConfig } from '@worldbinder/contracts'
import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { QuickCreateDialog, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StructuredDateEditor } from '../../calendar/components/StructuredDateEditor'
import { EMPTY_STRUCTURED_DATE, structuredToTimelineDate } from '../../calendar/lib/structuredDate'
import { useCreateTimelineEventMutation } from '../hooks/useTimeline'

export interface QuickCreateTimelineEventDialogProps {
  campaignId: string
  calendarConfig?: CalendarConfig
  open: boolean
  onClose: () => void
}

/**
 * Timeline counterpart to QuickCreateEntityDialog/QuickCreateSessionDialog.
 * Unlike sessions/threads, a timeline event's whole point is usually *when*
 * it happened, so this asks for the date up front too (via the same
 * calendar-aware StructuredDateEditor the full form uses) — but it stays
 * optional, since an undated event is a first-class case (see
 * TimelineListPage's "Undated" section), not a gap to fill in later.
 */
export function QuickCreateTimelineEventDialog({
  campaignId,
  calendarConfig = DEFAULT_CALENDAR_CONFIG,
  open,
  onClose,
}: QuickCreateTimelineEventDialogProps) {
  const navigate = useNavigate()
  const createEvent = useCreateTimelineEventMutation(campaignId)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(EMPTY_STRUCTURED_DATE)

  function handleClose() {
    setTitle('')
    setDate(EMPTY_STRUCTURED_DATE)
    createEvent.reset()
    onClose()
  }

  function handleSubmit() {
    if (!title.trim()) return
    const { date: startDateJson, precision } = structuredToTimelineDate(date)
    createEvent.mutate(
      { title, startDateJson, datePrecision: precision },
      {
        onSuccess: (event) => {
          handleClose()
          navigate(`/app/campaign/${campaignId}/world/timeline/${event.id}`)
        },
      },
    )
  }

  return (
    <QuickCreateDialog
      open={open}
      onClose={handleClose}
      title="New timeline event"
      onSubmit={handleSubmit}
      submitDisabled={!title.trim()}
      pending={createEvent.isPending}
      error={createEvent.error?.message}
    >
      <TextField
        id="quick-create-timeline-event-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <StructuredDateEditor
        legend="Date (optional)"
        calendarConfig={calendarConfig}
        value={date}
        onChange={setDate}
      />
    </QuickCreateDialog>
  )
}
