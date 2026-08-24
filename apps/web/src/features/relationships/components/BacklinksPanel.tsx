import { EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { useEntityBacklinksQuery } from '../hooks/useRelationships'

export interface BacklinksPanelProps {
  campaignId: string
  entityId: string
}

/**
 * Wiki-link backlinks — extracted from RelatedContentPanel (which used to
 * render this immediately after Relationships) so the entity detail rail
 * can position it after Attachments, matching docs/planning/ui-ux.md's
 * specified section order.
 */
export function BacklinksPanel({ campaignId, entityId }: BacklinksPanelProps) {
  const backlinksQuery = useEntityBacklinksQuery(campaignId, entityId)
  const backlinks = backlinksQuery.data ?? []

  return (
    <div className="wb-related-content">
      <div>
        <h2>Backlinks</h2>
        {backlinksQuery.isLoading && <LoadingState label="Loading backlinks…" />}
        {backlinksQuery.isError && (
          <ErrorState
            message={backlinksQuery.error.message}
            onRetry={() => backlinksQuery.refetch()}
          />
        )}
        {!backlinksQuery.isLoading && !backlinksQuery.isError && backlinks.length === 0 && (
          <EmptyState message="No backlinks yet." />
        )}
        {!backlinksQuery.isLoading && !backlinksQuery.isError && backlinks.length > 0 && (
          <ul className="wb-backlink-list">
            {backlinks.map((link) => (
              <li key={`${link.sourceEntity.id}-${link.section}`}>
                <Link to={`/app/campaign/${campaignId}/world/${link.sourceEntity.id}`}>
                  {link.sourceEntity.name}
                </Link>
                {link.section === 'gm' ? ' (GM only)' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
