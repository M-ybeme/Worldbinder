import type { TimelineEventSummary } from '@worldbinder/contracts'
import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { EmptyState, ErrorState, LoadingState, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityPicker } from '../../entities/components/EntityPicker'
import { formatTimelineDate } from '../lib/formatTimelineDate'
import { useTimelineEventsQuery } from '../hooks/useTimeline'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

function EventRow({ campaignId, event }: { campaignId: string; event: TimelineEventSummary }) {
  const calendarConfig =
    useCampaignOutletContext().campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG
  return (
    <li>
      <Link to={`/app/campaign/${campaignId}/world/timeline/${event.id}`}>{event.title}</Link>
      <span className="wb-session-list__meta">
        {formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)}
        {event.visibility === 'gm_only' ? ' · GM only' : ''}
      </span>
    </li>
  )
}

export function TimelineListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const [entityId, setEntityId] = useState<string | undefined>()
  const [tag, setTag] = useState('')

  const eventsQuery = useTimelineEventsQuery(campaign.id, {
    entityId,
    tag: tag.trim() || undefined,
  })
  const events = eventsQuery.data ?? []
  const dated = events.filter((e) => e.startDateJson !== null)
  const undated = events.filter((e) => e.startDateJson === null)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Timeline</h1>
        {canCreate && (
          <Link
            className="wb-button wb-button--primary"
            to={`/app/campaign/${campaign.id}/world/timeline/new`}
          >
            New timeline event
          </Link>
        )}
      </header>

      <div className="wb-form" style={{ marginBottom: '1rem' }}>
        <EntityPicker
          campaignId={campaign.id}
          label="Filter by entity"
          value={entityId}
          onChange={setEntityId}
        />
        <TextField label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {eventsQuery.isLoading && <LoadingState label="Loading timeline…" />}
      {eventsQuery.isError && (
        <ErrorState message={eventsQuery.error.message} onRetry={() => eventsQuery.refetch()} />
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && dated.length === 0 && (
        <EmptyState message="No dated events yet." />
      )}

      {!eventsQuery.isLoading && !eventsQuery.isError && dated.length > 0 && (
        <ul className="wb-session-list">
          {dated.map((event) => (
            <EventRow key={event.id} campaignId={campaign.id} event={event} />
          ))}
        </ul>
      )}

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
