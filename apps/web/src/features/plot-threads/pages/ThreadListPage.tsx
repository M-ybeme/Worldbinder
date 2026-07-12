import type { PlotThreadSummary } from '@worldbinder/contracts'
import { FormMessage } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { usePlotThreadsQuery } from '../hooks/usePlotThreads'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

function ThreadRow({ campaignId, thread }: { campaignId: string; thread: PlotThreadSummary }) {
  return (
    <li>
      <Link to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</Link>
      <span className="wb-session-list__meta">
        {thread.status ?? thread.playerFacingStatus}
        {thread.importance ? ` · ${thread.importance}` : ''}
        {thread.visibility === 'gm_only' ? ' · GM only' : ''}
      </span>
    </li>
  )
}

export function ThreadListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const threadsQuery = usePlotThreadsQuery(campaign.id)

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
        {canCreate && (
          <Link
            className="wb-button wb-button--primary"
            to={`/app/campaign/${campaign.id}/threads/new`}
          >
            New plot thread
          </Link>
        )}
      </header>

      {threadsQuery.isLoading && <p>Loading plot threads…</p>}
      {threadsQuery.isError && <FormMessage message={threadsQuery.error.message} />}

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
      <ul className="wb-session-list">
        {unresolved.map((thread) => (
          <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
        ))}
        {unresolved.length === 0 && !threadsQuery.isLoading && <li>No unresolved threads.</li>}
      </ul>

      <h2>All threads</h2>
      <ul className="wb-session-list">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
        ))}
        {threads.length === 0 && !threadsQuery.isLoading && <li>No plot threads yet.</li>}
      </ul>
    </section>
  )
}
