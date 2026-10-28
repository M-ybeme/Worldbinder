import type {
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntitySummary,
} from '@worldbinder/contracts'
import { Button } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { tiptapToPlainText, truncateText } from '../../../../lib/tiptapText'
import { ENTITY_TYPE_LABELS } from '../../../entities/lib/entityTypeIcons'
import { useSessionQuery } from '../../../sessions/hooks/useSessions'
import { formatSessionDate, formatSessionDateTime } from '../../lib/dashboardFormat'

const THREAD_ACTION_LABELS: Record<string, string> = {
  introduced: 'Introduced',
  advanced: 'Advanced',
  resolved: 'Resolved',
}

function sessionHeading(session: CampaignSessionSummary): string {
  return `Session ${session.sessionNumber} — ${session.title}`
}

/** Featured entities and locations, de-duplicated — a session can list the
 * same place in both. */
function featuredFor(detail: CampaignSessionDetail): EntitySummary[] {
  const seen = new Set<string>()
  return [...detail.featuredEntities, ...detail.locations].filter((entity) => {
    if (seen.has(entity.id)) return false
    seen.add(entity.id)
    return true
  })
}

function DetailStatus({
  query,
  label,
}: {
  query: ReturnType<typeof useSessionQuery>
  label: string
}) {
  if (query.isLoading) return <p className="wb-dash-muted">Loading {label}…</p>
  if (query.isError) {
    return (
      <p className="wb-dash-muted">
        Couldn’t load {label}.{' '}
        <button type="button" className="wb-dash-link-button" onClick={() => query.refetch()}>
          Try again
        </button>
      </p>
    )
  }
  return null
}

function UpcomingSession({
  campaignId,
  session,
  canEdit,
}: {
  campaignId: string
  session: CampaignSessionSummary
  canEdit: boolean
}) {
  const detailQuery = useSessionQuery(campaignId, session.id)
  const detail = detailQuery.data
  const sessionUrl = `/app/campaign/${campaignId}/sessions/${session.id}`
  const featured = detail ? featuredFor(detail) : []

  return (
    <div className="wb-dash-session wb-dash-session--next">
      <div className="wb-dash-row">
        <span className="wb-dash-eyebrow wb-dash-eyebrow--accent">
          Up next
          {session.scheduledAt && (
            <>
              {' · '}
              <time dateTime={session.scheduledAt}>
                {formatSessionDateTime(session.scheduledAt)}
              </time>
            </>
          )}
        </span>
        {canEdit && (
          <Link className="wb-dash-small-link" to={`${sessionUrl}/edit`}>
            Edit session
          </Link>
        )}
      </div>
      <h3 className="wb-dash-session__title">{sessionHeading(session)}</h3>

      <DetailStatus query={detailQuery} label="session details" />
      {detail && (
        <div className="wb-dash-session__columns">
          <div>
            <h4 className="wb-dash-eyebrow">Plot threads in this session</h4>
            {detail.plotThreadChanges.length === 0 ? (
              <p className="wb-dash-muted">No threads linked yet.</p>
            ) : (
              <ul className="wb-dash-list">
                {detail.plotThreadChanges.map(({ plotThread, action }) => (
                  <li key={`${plotThread.id}-${action}`}>
                    <Link to={`/app/campaign/${campaignId}/threads/${plotThread.id}`}>
                      {plotThread.title}
                    </Link>
                    <span className="wb-dash-meta">{THREAD_ACTION_LABELS[action] ?? action}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="wb-dash-eyebrow">Featured in this session</h4>
            {featured.length === 0 ? (
              <p className="wb-dash-muted">No entries featured yet.</p>
            ) : (
              <ul className="wb-dash-list">
                {featured.map((entity) => (
                  <li key={entity.id}>
                    <Link to={`/app/campaign/${campaignId}/world/${entity.id}`}>{entity.name}</Link>
                    <span className="wb-dash-meta">{ENTITY_TYPE_LABELS[entity.entityType]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="wb-dash-actions">
        <Link className="wb-button wb-button--primary" to={sessionUrl}>
          Open session prep
        </Link>
      </div>
    </div>
  )
}

function NoUpcomingSession({
  campaignId,
  neglectedCount,
  onPlanSession,
}: {
  campaignId: string
  neglectedCount: number
  onPlanSession: (() => void) | null
}) {
  return (
    <div className="wb-dash-session wb-dash-session--next">
      <div className="wb-dash-row">
        <span className="wb-dash-eyebrow">Up next</span>
        {/* Planned sessions without a date aren't "up next" — this is where
          they get scheduled. */}
        <Link className="wb-dash-small-link" to={`/app/campaign/${campaignId}/sessions`}>
          All sessions
        </Link>
      </div>
      <h3 className="wb-dash-session__title">No session scheduled</h3>
      <p className="wb-dash-secondary">
        Schedule the next session to see its plot threads and featured entries here.
        {neglectedCount > 0 &&
          ` ${neglectedCount} ${neglectedCount === 1 ? 'thread is' : 'threads are'} waiting to be picked up.`}
      </p>
      {(onPlanSession || neglectedCount > 0) && (
        <div className="wb-dash-actions">
          {onPlanSession && <Button onClick={onPlanSession}>Plan next session</Button>}
          {neglectedCount > 0 && (
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaignId}/threads?status=neglected`}
            >
              See neglected threads
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function LastSession({
  campaignId,
  session,
  canEdit,
}: {
  campaignId: string
  session: CampaignSessionSummary
  canEdit: boolean
}) {
  const detailQuery = useSessionQuery(campaignId, session.id)
  const detail = detailQuery.data
  const sessionUrl = `/app/campaign/${campaignId}/sessions/${session.id}`
  const recap = detail ? truncateText(tiptapToPlainText(detail.recapContentJson), 280) : ''

  return (
    <div className="wb-dash-session">
      <div className="wb-dash-row">
        <span className="wb-dash-eyebrow">
          Last time
          {session.playedAt && (
            <>
              {' · '}
              <time dateTime={session.playedAt}>{formatSessionDate(session.playedAt)}</time>
            </>
          )}
        </span>
        <Link className="wb-dash-small-link" to={`/app/campaign/${campaignId}/sessions`}>
          All sessions
        </Link>
      </div>
      <h3 className="wb-dash-session__title wb-dash-session__title--small">
        <Link to={sessionUrl}>{sessionHeading(session)}</Link>
      </h3>

      <DetailStatus query={detailQuery} label="the recap" />
      {detail && (
        <>
          {recap ? (
            <p className="wb-dash-secondary">{recap}</p>
          ) : (
            <p className="wb-dash-muted">
              No recap written yet.
              {canEdit && (
                <>
                  {' '}
                  <Link to={`${sessionUrl}/edit`}>Write one</Link>
                </>
              )}
            </p>
          )}
          {detail.plotThreadChanges.length > 0 && (
            <div className="wb-dash-chips" aria-label="Plot thread changes">
              <span className="wb-dash-meta">Threads:</span>
              {detail.plotThreadChanges.map(({ plotThread, action }) => (
                <Link
                  key={`${plotThread.id}-${action}`}
                  className="wb-dash-chip"
                  to={`/app/campaign/${campaignId}/threads/${plotThread.id}`}
                >
                  {plotThread.title}
                  <span className="wb-dash-chip__note">
                    {' '}
                    · {(THREAD_ACTION_LABELS[action] ?? action).toLowerCase()}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {detail.reveals.length > 0 && (
            <div className="wb-dash-chips">
              <span className="wb-dash-meta">Revealed to players:</span>
              {detail.reveals.map((entity) => (
                <Link
                  key={entity.id}
                  className="wb-dash-chip"
                  to={`/app/campaign/${campaignId}/world/${entity.id}`}
                >
                  {entity.name}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The Dashboard's lead panel: the next scheduled session (its linked plot
 * threads and featured entries, from the session's own detail) above a
 * recap of the last completed one. Both sessions come from the dashboard
 * query, already filtered to what this member may see; the detail query
 * applies the same per-entity visibility rules server-side.
 */
export function SessionPanel({
  campaignId,
  upcoming,
  last,
  canEdit,
  neglectedCount,
  onPlanSession,
}: {
  campaignId: string
  upcoming: CampaignSessionSummary | null
  last: CampaignSessionSummary | null
  canEdit: boolean
  neglectedCount: number
  onPlanSession: (() => void) | null
}) {
  return (
    <section className="wb-dash-card wb-dash-card--flush" aria-labelledby="wb-dash-sessions">
      <h2 id="wb-dash-sessions" className="wb-visually-hidden">
        Sessions
      </h2>
      {upcoming ? (
        <UpcomingSession campaignId={campaignId} session={upcoming} canEdit={canEdit} />
      ) : (
        <NoUpcomingSession
          campaignId={campaignId}
          neglectedCount={neglectedCount}
          onPlanSession={onPlanSession}
        />
      )}
      {last && <LastSession campaignId={campaignId} session={last} canEdit={canEdit} />}
    </section>
  )
}
