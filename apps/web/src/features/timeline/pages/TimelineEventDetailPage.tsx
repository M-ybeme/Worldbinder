import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { Button, FormMessage } from '@worldbinder/ui'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { formatTimelineDate } from '../lib/formatTimelineDate'
import { useDeleteTimelineEventMutation, useTimelineEventQuery } from '../hooks/useTimeline'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function TimelineEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const calendarConfig = campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG

  const eventQuery = useTimelineEventQuery(campaign.id, eventId)
  const deleteEvent = useDeleteTimelineEventMutation(campaign.id)
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

  if (eventQuery.isLoading) return <p>Loading…</p>
  if (eventQuery.isError || !eventQuery.data) {
    return <FormMessage message="This timeline event could not be found." />
  }

  const event = eventQuery.data
  const dateRange =
    event.endDateJson && event.startDateJson
      ? `${formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)} – ${formatTimelineDate(event.endDateJson, event.datePrecision, calendarConfig)}`
      : formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)

  return (
    <section>
      <header className="wb-entity-header">
        <h1>{event.title}</h1>
        <span className="wb-entity-header__meta">
          {dateRange}
          {event.visibility === 'gm_only' ? ' · GM only' : ''}
        </span>
      </header>

      {canManage && (
        <div className="wb-entity-header__actions">
          <Link
            className="wb-button wb-button--secondary"
            to={`/app/campaign/${campaign.id}/world/timeline/${event.id}/edit`}
          >
            Edit
          </Link>
          <Button
            variant="secondary"
            disabled={deleteEvent.isPending}
            onClick={() => {
              if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return
              deleteEvent.mutate(event.id, {
                onSuccess: () => navigate(`/app/campaign/${campaign.id}/world/timeline`),
              })
            }}
          >
            Delete
          </Button>
        </div>
      )}

      {event.summary && <p>{event.summary}</p>}

      <RichTextEditor
        label="Content"
        content={event.contentJson}
        editable={false}
        campaignId={campaign.id}
      />

      {event.tags.length > 0 && (
        <p>
          <strong>Tags:</strong> {event.tags.join(', ')}
        </p>
      )}

      <div className="wb-related-content">
        <div>
          <h2>Related Entities</h2>
          {event.entities.length === 0 && <p>No related entities.</p>}
          <ul className="wb-relationship-list">
            {event.entities.map((entity) => (
              <li key={entity.id}>
                <Link to={`/app/campaign/${campaign.id}/world/${entity.id}`}>{entity.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Related Sessions</h2>
          {event.sessions.length === 0 && <p>No related sessions.</p>}
          <ul className="wb-relationship-list">
            {event.sessions.map((session) => (
              <li key={session.id}>
                <Link to={`/app/campaign/${campaign.id}/sessions/${session.id}`}>
                  Session {session.sessionNumber}: {session.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
