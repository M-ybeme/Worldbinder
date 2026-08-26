import type { CampaignAuditEventType } from '@worldbinder/contracts'
import { Button, EmptyState, FormMessage, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useAuditEventsQuery } from '../hooks/useAudit'

const PAGE_SIZE = 50

const EVENT_LABELS: Record<CampaignAuditEventType, string> = {
  member_role_changed: 'Member role changed',
  member_removed: 'Member removed',
  content_revealed: 'Content revealed',
  revision_restored: 'Revision restored',
  campaign_archived: 'Campaign archived',
  campaign_deleted: 'Campaign deleted',
  destructive_action: 'Destructive action',
  campaign_exported: 'Campaign exported',
  campaign_imported: 'Campaign imported',
}

/** Owner/gm-only campaign activity feed (backend enforces this too — see
 * `campaign-audit.controller.ts`). Reachable from `CampaignLayout`'s
 * secondary nav (gated by the same `canManage` check as Settings). */
export function AuditPage() {
  const { campaign } = useCampaignOutletContext()
  const [page, setPage] = useState(1)

  const eventsQuery = useAuditEventsQuery(campaign.id, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const events = eventsQuery.data ?? []
  const hasNextPage = events.length === PAGE_SIZE

  return (
    <section>
      <header className="wb-world-header">
        <h1>Activity log</h1>
      </header>

      {eventsQuery.isLoading && <LoadingState label="Loading activity log…" />}
      {eventsQuery.isError && (
        <FormMessage message="You don't have permission to view this campaign's activity log." />
      )}
      {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
        <EmptyState message="No activity recorded yet." />
      )}

      <ul className="wb-session-list">
        {events.map((event) => (
          <li key={event.id}>
            <div>
              <strong>{EVENT_LABELS[event.type]}</strong>
              {event.targetResourceType && (
                <span className="wb-session-list__meta">
                  {' '}
                  · {event.targetResourceType}
                  {event.targetResourceId ? ` (${event.targetResourceId.slice(0, 8)})` : ''}
                </span>
              )}
            </div>
            <span className="wb-session-list__meta">
              {event.actorDisplayName ?? 'Unknown'} · {new Date(event.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      {(page > 1 || hasNextPage) && (
        <nav className="wb-pagination" aria-label="Activity log pages">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  )
}
