import type { CalendarConfig, TimelineEventSummary } from '@worldbinder/contracts'
import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { Badge, Button, EmptyState, ErrorState, LoadingState, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityPicker } from '../../entities/components/EntityPicker'
import { QuickCreateTimelineEventDialog } from '../components/QuickCreateTimelineEventDialog'
import { formatTimelineDate } from '../lib/formatTimelineDate'
import { useTimelineEventsQuery } from '../hooks/useTimeline'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

interface DateGroup {
  key: string
  header: string
  events: TimelineEventSummary[]
}

/** Dated events arrive from the API already sorted ascending by calendar
 * ordinal (`TimelineService`'s `compareEventRows`), so grouping is a
 * single pass — a new group starts whenever the (year, month) key changes
 * (year-precision events group by year alone). Reuses `formatTimelineDate`
 * itself for the header text (already handles year/month precision using
 * the campaign's own calendar month names), rather than a second
 * formatting function. */
function groupDatedEvents(
  events: TimelineEventSummary[],
  calendarConfig: CalendarConfig,
): DateGroup[] {
  const groups: DateGroup[] = []
  for (const event of events) {
    const { startDateJson: date, datePrecision: precision } = event
    if (!date || !precision) continue

    const key = precision === 'year' ? `${date.year}` : `${date.year}-${date.month}`
    const last = groups[groups.length - 1]
    if (last?.key === key) {
      last.events.push(event)
      continue
    }

    const header =
      precision === 'year'
        ? formatTimelineDate({ schemaVersion: 1, year: date.year }, 'year', calendarConfig)
        : formatTimelineDate(
            { schemaVersion: 1, year: date.year, month: date.month },
            'month',
            calendarConfig,
          )
    groups.push({ key, header, events: [event] })
  }
  return groups
}

function EventRow({ campaignId, event }: { campaignId: string; event: TimelineEventSummary }) {
  const calendarConfig =
    useCampaignOutletContext().campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG
  return (
    <li>
      <Link to={`/app/campaign/${campaignId}/world/timeline/${event.id}`}>{event.title}</Link>
      <span className="wb-session-list__meta">
        {formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)}
        {event.visibility === 'gm_only' && (
          <>
            {' '}
            <Badge tone="warning">GM only</Badge>
          </>
        )}
      </span>
    </li>
  )
}

export function TimelineListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const calendarConfig = campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG
  const [entityId, setEntityId] = useState<string | undefined>()
  const [tag, setTag] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const eventsQuery = useTimelineEventsQuery(campaign.id, {
    entityId,
    tag: tag.trim() || undefined,
  })
  const events = eventsQuery.data ?? []
  const dated = events.filter((e) => e.startDateJson !== null)
  const undated = events.filter((e) => e.startDateJson === null)
  const dateGroups = groupDatedEvents(dated, calendarConfig)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Timeline</h1>
        {canCreate && <Button onClick={() => setQuickCreateOpen(true)}>New timeline event</Button>}
      </header>

      <QuickCreateTimelineEventDialog
        campaignId={campaign.id}
        calendarConfig={calendarConfig}
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

      <div className="wb-form" style={{ marginBottom: '1rem' }}>
        <EntityPicker
          campaignId={campaign.id}
          label="Filter by entity"
          value={entityId}
          onChange={setEntityId}
        />
        <TextField
          id="timeline-tag-filter"
          label="Filter by tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {eventsQuery.isLoading && <LoadingState label="Loading timeline…" />}
      {eventsQuery.isError && (
        <ErrorState message={eventsQuery.error.message} onRetry={() => eventsQuery.refetch()} />
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && dated.length === 0 && (
        <EmptyState message="No dated events yet." />
      )}

      {!eventsQuery.isLoading &&
        !eventsQuery.isError &&
        dateGroups.map((group) => (
          <div key={group.key}>
            <h2>{group.header}</h2>
            <ul className="wb-session-list">
              {group.events.map((event) => (
                <EventRow key={event.id} campaignId={campaign.id} event={event} />
              ))}
            </ul>
          </div>
        ))}

      {undated.length > 0 && (
        <>
          <h2>Undated</h2>
          <ul className="wb-session-list">
            {undated.map((event) => (
              <EventRow key={event.id} campaignId={campaign.id} event={event} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
