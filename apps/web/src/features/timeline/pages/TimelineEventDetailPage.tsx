import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { Badge, Button, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '@worldbinder/ui'
import { useState } from 'react'
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  if (eventQuery.isLoading) return <LoadingState label="Loading timeline event…" />
  if (eventQuery.isError || !eventQuery.data) {
    return (
      <ErrorState
        message="This timeline event could not be found."
        onRetry={() => eventQuery.refetch()}
      />
    )
  }

  const event = eventQuery.data
  const dateRange =
    event.endDateJson && event.startDateJson
      ? `${formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)} – ${formatTimelineDate(event.endDateJson, event.datePrecision, calendarConfig)}`
      : formatTimelineDate(event.startDateJson, event.datePrecision, calendarConfig)

  return (
    <section>
      <PageHeader
        title={event.title}
        meta={
          <>
            <span>{dateRange}</span>
            {event.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
          </>
        }
        actions={
          canManage && (
            <>
              <Link
                className="wb-button wb-button--secondary"
                to={`/app/campaign/${campaign.id}/world/timeline/${event.id}/edit`}
              >
                Edit
              </Link>
              <Button
                variant="secondary"
                disabled={deleteEvent.isPending}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete
              </Button>
            </>
          )
        }
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete "${event.title}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteEvent.isPending}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          deleteEvent.mutate(event.id, {
            onSuccess: () => navigate(`/app/campaign/${campaign.id}/world/timeline`),
          })
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

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
