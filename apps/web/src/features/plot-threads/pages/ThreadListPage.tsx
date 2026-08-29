import type { PlotThreadSummary } from '@worldbinder/contracts'
import { Badge, Button, EmptyState, ErrorState, LoadingState, Select } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateThreadDialog } from '../components/QuickCreateThreadDialog'
import { usePlotThreadsQuery } from '../hooks/usePlotThreads'
import '../plot-threads.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

type StatusFilter = 'unresolved' | 'neglected' | 'all'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'neglected', label: 'Neglected' },
  { value: 'all', label: 'All threads' },
]

function isUnresolved(thread: PlotThreadSummary): boolean {
  return (
    thread.status !== 'resolved' &&
    thread.status !== 'abandoned' &&
    thread.playerFacingStatus !== 'completed'
  )
}

function ThreadRow({ campaignId, thread }: { campaignId: string; thread: PlotThreadSummary }) {
  return (
    <li>
      <Link to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</Link>
      <span className="wb-session-list__meta">
        {thread.status ?? thread.playerFacingStatus}
        {thread.importance ? ` · ${thread.importance}` : ''}
        {thread.neglected && (
          <>
            {' '}
            <Badge tone="warning">Neglected</Badge>
          </>
        )}
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unresolved')

  const threads = threadsQuery.data ?? []
  const filteredThreads =
    statusFilter === 'all'
      ? threads
      : statusFilter === 'neglected'
        ? threads.filter((t) => t.neglected)
        : threads.filter(isUnresolved)

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

      <div className="wb-thread-filters">
        <Select
          id="threadStatusFilter"
          label="Status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        />
      </div>

      {threadsQuery.isLoading && <LoadingState label="Loading plot threads…" />}
      {threadsQuery.isError && (
        <ErrorState message={threadsQuery.error.message} onRetry={() => threadsQuery.refetch()} />
      )}

      {!threadsQuery.isLoading &&
        !threadsQuery.isError &&
        (filteredThreads.length === 0 ? (
          <EmptyState
            message={
              threads.length === 0
                ? 'No plot threads yet.'
                : statusFilter === 'neglected'
                  ? 'No neglected threads.'
                  : 'No unresolved threads.'
            }
          />
        ) : (
          <ul className="wb-session-list">
            {filteredThreads.map((thread) => (
              <ThreadRow key={thread.id} campaignId={campaign.id} thread={thread} />
            ))}
          </ul>
        ))}
    </section>
  )
}
