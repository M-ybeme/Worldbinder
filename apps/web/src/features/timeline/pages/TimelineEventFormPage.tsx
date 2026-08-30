import type { EntityVisibility, TiptapDoc } from '@worldbinder/contracts'
import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import {
  Button,
  ErrorState,
  FormMessage,
  LoadingState,
  Select,
  TagInput,
  TextField,
  Textarea,
} from '@worldbinder/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityMultiPicker } from '../../entities/components/EntityMultiPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { StructuredDateEditor } from '../../calendar/components/StructuredDateEditor'
import {
  EMPTY_STRUCTURED_DATE,
  structuredToTimelineDate,
  timelineDateToStructured,
} from '../../calendar/lib/structuredDate'
import { SessionMultiPicker } from '../components/SessionMultiPicker'
import { useTimelineEventQuery, useUpdateTimelineEventMutation } from '../hooks/useTimeline'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

export function TimelineEventFormPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const calendarConfig = campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG

  const eventQuery = useTimelineEventQuery(campaign.id, eventId)
  const updateEvent = useUpdateTimelineEventMutation(campaign.id, eventId ?? '')

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState<TiptapDoc | null>(null)
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [startDate, setStartDate] = useState(EMPTY_STRUCTURED_DATE)
  const [endDate, setEndDate] = useState(EMPTY_STRUCTURED_DATE)
  const [entityIds, setEntityIds] = useState<string[]>([])
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    if (!eventQuery.data) return
    const event = eventQuery.data
    setTitle(event.title)
    setSummary(event.summary ?? '')
    setContent(event.contentJson)
    setVisibility(event.visibility)
    setStartDate(timelineDateToStructured(event.startDateJson, event.datePrecision))
    setEndDate(timelineDateToStructured(event.endDateJson, event.datePrecision))
    setEntityIds(event.entities.map((e) => e.id))
    setSessionIds(event.sessions.map((s) => s.id))
    setTags(event.tags)
  }, [eventQuery.data])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    const start = structuredToTimelineDate(startDate)
    const end = structuredToTimelineDate(endDate)

    const payload = {
      title,
      summary: summary.trim() || undefined,
      contentJson: content ?? undefined,
      startDateJson: start.date,
      datePrecision: start.precision,
      endDateJson: end.date,
      visibility,
      entityIds,
      sessionIds,
      tags,
    }

    const result = await updateEvent.mutateAsync(payload)
    navigate(`/app/campaign/${campaign.id}/world/timeline/${result.id}`)
  }

  if (eventQuery.isLoading) return <LoadingState label="Loading timeline event…" />
  if (eventQuery.isError) {
    return (
      <ErrorState
        message="This timeline event could not be loaded."
        onRetry={() => eventQuery.refetch()}
      />
    )
  }

  return (
    <section>
      <h1>Edit timeline event</h1>

      <form className="wb-form wb-form--wide" onSubmit={(e) => void onSubmit(e)} noValidate>
        <TextField
          id="title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          id="summary"
          label="Summary (optional)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Select
          id="visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
        />

        <StructuredDateEditor
          legend="Start date"
          calendarConfig={calendarConfig}
          value={startDate}
          onChange={setStartDate}
        />
        <StructuredDateEditor
          legend="End date (optional, for a range)"
          calendarConfig={calendarConfig}
          value={endDate}
          onChange={setEndDate}
        />

        <RichTextEditor
          label="Content"
          content={content}
          onChange={setContent}
          campaignId={campaign.id}
        />

        <EntityMultiPicker
          campaignId={campaign.id}
          label="Related entities"
          value={entityIds}
          onChange={setEntityIds}
        />
        <SessionMultiPicker
          campaignId={campaign.id}
          label="Related sessions"
          value={sessionIds}
          onChange={setSessionIds}
        />
        <TagInput label="Tags" value={tags} onChange={setTags} />

        <FormMessage message={updateEvent.error?.message} />
        <Button type="submit" disabled={updateEvent.isPending}>
          {updateEvent.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </section>
  )
}
