import type { CampaignActivityItem, EntitySummary } from '@worldbinder/contracts'
import { CalendarDays, GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EntityTypeIcon } from '../../../entities/lib/entityTypeIcons'
import { formatAge } from '../../lib/dashboardFormat'

const ACTIVITY_LIMIT = 6

function activityLink(campaignId: string, item: CampaignActivityItem): string {
  const base = `/app/campaign/${campaignId}`
  if (item.resourceType === 'entity') return `${base}/world/${item.id}`
  if (item.resourceType === 'session') return `${base}/sessions/${item.id}`
  return `${base}/threads/${item.id}`
}

const RESOURCE_LABELS: Record<CampaignActivityItem['resourceType'], string> = {
  entity: 'entry',
  session: 'session',
  plot_thread: 'plot thread',
}

// Same icons the sidebar uses for Sessions/Threads, for consistency.
function ActivityIcon({ item }: { item: CampaignActivityItem }) {
  if (item.resourceType === 'entity' && item.entityType) {
    return <EntityTypeIcon type={item.entityType} />
  }
  if (item.resourceType === 'session') return <CalendarDays size={16} aria-hidden="true" />
  return <GitBranch size={16} aria-hidden="true" />
}

/**
 * The Dashboard's secondary column: what changed recently (one feed across
 * entries, sessions and plot threads, already visibility-filtered by the
 * API) and this member's own favorites.
 */
export function RecentPanel({
  campaignId,
  recentActivity,
  favoriteEntities,
  canViewAuditLog,
}: {
  campaignId: string
  recentActivity: CampaignActivityItem[]
  favoriteEntities: EntitySummary[]
  canViewAuditLog: boolean
}) {
  return (
    <aside className="wb-dash-aside" aria-label="Recent and favorites">
      <section className="wb-dash-card" aria-labelledby="wb-dash-recent">
        <h2 id="wb-dash-recent" className="wb-dash-card__title">
          Recently changed
        </h2>
        {recentActivity.length === 0 ? (
          <p className="wb-dash-muted">Nothing has changed yet.</p>
        ) : (
          <ul className="wb-dash-list wb-dash-list--compact">
            {recentActivity.slice(0, ACTIVITY_LIMIT).map((item) => (
              <li key={`${item.resourceType}-${item.id}`}>
                <ActivityIcon item={item} />
                <Link className="wb-dash-ellipsis" to={activityLink(campaignId, item)}>
                  {item.title}
                </Link>
                <span className="wb-visually-hidden">, {RESOURCE_LABELS[item.resourceType]}</span>
                <time className="wb-dash-meta" dateTime={item.updatedAt}>
                  {formatAge(item.updatedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        {canViewAuditLog && (
          <Link className="wb-dash-small-link" to={`/app/campaign/${campaignId}/audit`}>
            Full activity log
          </Link>
        )}
      </section>

      <section className="wb-dash-card" aria-labelledby="wb-dash-favorites">
        <h2 id="wb-dash-favorites" className="wb-dash-card__title">
          Favorites
        </h2>
        {favoriteEntities.length === 0 ? (
          <p className="wb-dash-muted">Star an entry in the World to pin it here.</p>
        ) : (
          <ul className="wb-dash-chips" aria-label="Favorite entries">
            {favoriteEntities.map((entity) => (
              <li key={entity.id}>
                <Link className="wb-dash-chip" to={`/app/campaign/${campaignId}/world/${entity.id}`}>
                  <EntityTypeIcon type={entity.entityType} size={14} />
                  {entity.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
