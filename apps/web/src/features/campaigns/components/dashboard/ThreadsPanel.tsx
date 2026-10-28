import type { PlotThreadImportance, PlotThreadSummary } from '@worldbinder/contracts'
import { Badge, Button, type BadgeTone } from '@worldbinder/ui'
import { Link } from 'react-router-dom'

const ACTIVE_LIMIT = 6

const IMPORTANCE_TONES: Record<PlotThreadImportance, BadgeTone> = {
  critical: 'danger',
  major: 'warning',
  standard: 'neutral',
  minor: 'info',
}

const IMPORTANCE_LABELS: Record<PlotThreadImportance, string> = {
  critical: 'Critical',
  major: 'Major',
  standard: 'Standard',
  minor: 'Minor',
}

function lastSeen(thread: PlotThreadSummary): string {
  return thread.lastReferencedSession
    ? `last in Session ${thread.lastReferencedSession.sessionNumber}`
    : 'not in a session yet'
}

/**
 * Active plot threads, with the server's own "neglected" ones (unresolved
 * and not referenced by a recent played session — see `isNeglected` in the
 * API) pulled out first as "Needs attention". Importance is GM-only data:
 * the API omits it for other viewers, so the badge simply doesn't render.
 */
export function ThreadsPanel({
  campaignId,
  activeThreads,
  neglectedThreads,
  onNewThread,
}: {
  campaignId: string
  activeThreads: PlotThreadSummary[]
  neglectedThreads: PlotThreadSummary[]
  onNewThread: (() => void) | null
}) {
  const neglectedIds = new Set(neglectedThreads.map((thread) => thread.id))
  const others = activeThreads.filter((thread) => !neglectedIds.has(thread.id))
  const shown = others.slice(0, ACTIVE_LIMIT)
  const threadsUrl = `/app/campaign/${campaignId}/threads`
  const isEmpty = neglectedThreads.length === 0 && others.length === 0

  return (
    <section className="wb-dash-card" aria-labelledby="wb-dash-threads">
      <div className="wb-dash-row">
        <h2 id="wb-dash-threads" className="wb-dash-card__title">
          Plot threads
        </h2>
        <Link className="wb-dash-small-link" to={threadsUrl}>
          All threads
        </Link>
      </div>

      {isEmpty && (
        <div className="wb-dash-empty">
          <p className="wb-dash-muted">No active plot threads.</p>
          {onNewThread && (
            <Button variant="secondary" onClick={onNewThread}>
              New plot thread
            </Button>
          )}
        </div>
      )}

      {neglectedThreads.length > 0 && (
        <div className="wb-dash-attention">
          <h3 id="wb-dash-attention" className="wb-dash-attention__title">
            Needs attention
            <span className="wb-dash-attention__hint"> · not picked up in recent sessions</span>
          </h3>
          <ul className="wb-dash-list">
            {neglectedThreads.map((thread) => (
              <li key={thread.id}>
                <Link to={`${threadsUrl}/${thread.id}`}>{thread.title}</Link>
                <span className="wb-dash-meta">{lastSeen(thread)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="wb-dash-list" aria-label="Other active threads">
          {shown.map((thread) => (
            <li key={thread.id}>
              <Link to={`${threadsUrl}/${thread.id}`}>{thread.title}</Link>
              {thread.importance && (
                <Badge tone={IMPORTANCE_TONES[thread.importance]}>
                  {IMPORTANCE_LABELS[thread.importance]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {others.length > ACTIVE_LIMIT && (
        <Link className="wb-dash-small-link" to={threadsUrl}>
          {others.length - ACTIVE_LIMIT} more active
        </Link>
      )}
    </section>
  )
}
