import type { PlotThreadSummary } from '@worldbinder/contracts'
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateThreadDialog } from '../components/QuickCreateThreadDialog'
import { usePlotThreadsQuery } from '../hooks/usePlotThreads'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

function ThreadRow({ campaignId, thread }: { campaignId: string; thread: PlotThreadSummary }) {
  return (
    <li>
      <Link to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</Link>
      <span className="wb-session-list__meta">
        {thread.status ?? thread.playerFacingStatus}
        {thread.importance ? ` · ${thread.importance}` : ''}
        {thread.visibility === 'gm_only' && (
          <>
            {' '}
            <Badge tone="warning">GM only</Badge>
          </>
        )}
      </span>
    </li>
  )
}

export function ThreadListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const threadsQuery = usePlotThreadsQuery(campaign.id)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const threads = threadsQuery.data ?? []
  const unresolved = threads.filter(
    (t) =>
      t.status !== 'resolved' && t.status !== 'abandoned' && t.playerFacingStatus !== 'completed',
  )
  const neglected = threads.filter((t) => t.neglected)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Threads</h1>
        {canCreate && <Button onClick={() => setQuickCreateOpen(true)}>New plot thread</Button>}
      </header>

      <QuickCreateThreadDialog
        campaignId={campaign.id}
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

      {threadsQuery.isLoading && <LoadingState label="Loading plot threads…" />}
      {threadsQuery.isError && (
        <ErrorState message={threadsQuery.error.message} onRetry={() => threadsQuery.refetch()} />
      )}

      {!threadsQuery.isLoading && !threadsQuery.isError && (
        <>
          {neglected.length > 0 && (
            <>
              <h2>Neglected</h2>
              <ul className="wb-session-list">
                {neglected.map((thread) => (
                  <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
                ))}
              </ul>
            </>
          )}

          <h2>Unresolved</h2>
          {unresolved.length === 0 ? (
            <EmptyState message="No unresolved threads." />
          ) : (
            <ul className="wb-session-list">
              {unresolved.map((thread) => (
                <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
              ))}
            </ul>
          )}

          <h2>All threads</h2>
          {threads.length === 0 ? (
            <EmptyState message="No plot threads yet." />
          ) : (
            <ul className="wb-session-list">
              {threads.map((thread) => (
                <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
