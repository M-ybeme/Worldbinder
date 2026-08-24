import { EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { useEntityPlotThreadsQuery } from '../../entities/hooks/useEntities'

export interface EntityPlotThreadsPanelProps {
  campaignId: string
  entityId: string
}

/**
 * Plot threads connected to this entity — the entity detail page's rail
 * previously had no way to see this at all (the relation only existed
 * thread → entities), a gap flagged against docs/planning/ui-ux.md's
 * specified section order (Relationships → Plot Threads → Attachments).
 */
export function EntityPlotThreadsPanel({ campaignId, entityId }: EntityPlotThreadsPanelProps) {
  const threadsQuery = useEntityPlotThreadsQuery(campaignId, entityId)
  const threads = threadsQuery.data ?? []

  return (
    <div className="wb-related-content">
      <div>
        <h2>Plot Threads</h2>
        {threadsQuery.isLoading && <LoadingState label="Loading plot threads…" />}
        {threadsQuery.isError && (
          <ErrorState message={threadsQuery.error.message} onRetry={() => threadsQuery.refetch()} />
        )}
        {!threadsQuery.isLoading && !threadsQuery.isError && threads.length === 0 && (
          <EmptyState message="No plot threads yet." />
        )}
        {!threadsQuery.isLoading && !threadsQuery.isError && threads.length > 0 && (
          <ul className="wb-relationship-list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</Link>
                {thread.importance ? ` · ${thread.importance}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
