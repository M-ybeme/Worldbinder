import type { CampaignActivityItem, WorldDate } from '@worldbinder/contracts'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import { useCampaignDashboardQuery } from '../hooks/useCampaigns'

function formatWorldDate(date: WorldDate | null | undefined): string | null {
  if (!date) return null
  return (
    date.label ??
    `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  )
}

function activityLink(campaignId: string, item: CampaignActivityItem): string {
  const base = `/app/campaign/${campaignId}`
  if (item.resourceType === 'entity') return `${base}/world/${item.id}`
  if (item.resourceType === 'session') return `${base}/sessions/${item.id}`
  return `${base}/threads/${item.id}`
}

/**
 * The campaign "Dashboard" (roadmap §11.2/ui-ux.md) — this is the same
 * index route the Milestone 2-era campaign overview used, upgraded in
 * place rather than added as a separate `/dashboard` route, so the nav
 * stays as small as the roadmap's own "Dashboard, World, Sessions,
 * Threads, Maps, Search" model calls for.
 */
export function CampaignOverviewPage() {
  const { campaign } = useCampaignOutletContext()
  const dashboardQuery = useCampaignDashboardQuery(campaign.id)
  const dashboard = dashboardQuery.data

  return (
    <section>
      <p>{campaign.description ?? 'No description yet.'}</p>
      <dl className="wb-campaign-overview">
        <dt>System</dt>
        <dd>{campaign.systemName ?? '—'}</dd>
        <dt>Status</dt>
        <dd>{campaign.status}</dd>
        <dt>Your role</dt>
        <dd>{campaign.role}</dd>
        <dt>Current in-world date</dt>
        <dd>{formatWorldDate(dashboard?.currentWorldDateJson) ?? '—'}</dd>
      </dl>

      <div className="wb-related-content">
        <div>
          <h2>Sessions</h2>
          <p>
            Upcoming:{' '}
            {dashboard?.upcomingSession ? (
              <Link to={`/app/campaign/${campaign.id}/sessions/${dashboard.upcomingSession.id}`}>
                Session {dashboard.upcomingSession.sessionNumber}: {dashboard.upcomingSession.title}
              </Link>
            ) : (
              'None scheduled'
            )}
          </p>
          <p>
            Last played:{' '}
            {dashboard?.lastPlayedSession ? (
              <Link to={`/app/campaign/${campaign.id}/sessions/${dashboard.lastPlayedSession.id}`}>
                Session {dashboard.lastPlayedSession.sessionNumber}:{' '}
                {dashboard.lastPlayedSession.title}
              </Link>
            ) : (
              'None yet'
            )}
          </p>
        </div>

        <div>
          <h2>Active Plot Threads</h2>
          {dashboard && dashboard.activeThreads.length === 0 && <p>No active plot threads.</p>}
          <ul className="wb-relationship-list">
            {dashboard?.activeThreads.map((thread) => (
              <li key={thread.id}>
                <Link to={`/app/campaign/${campaign.id}/threads/${thread.id}`}>{thread.title}</Link>
                {thread.importance ? ` · ${thread.importance}` : ''}
              </li>
            ))}
          </ul>
        </div>

        {dashboard && dashboard.neglectedThreads.length > 0 && (
          <div>
            <h2>Dormant Threads Requiring Attention</h2>
            <ul className="wb-relationship-list">
              {dashboard.neglectedThreads.map((thread) => (
                <li key={thread.id}>
                  <Link to={`/app/campaign/${campaign.id}/threads/${thread.id}`}>
                    {thread.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h2>Recent Activity</h2>
          {dashboard && dashboard.recentActivity.length === 0 && <p>Nothing yet.</p>}
          <ul className="wb-relationship-list">
            {dashboard?.recentActivity.map((item) => (
              <li key={`${item.resourceType}-${item.id}`}>
                <Link to={activityLink(campaign.id, item)}>{item.title}</Link>
                {` · ${item.resourceType.replace('_', ' ')}`}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Quick Actions</h2>
          <div className="wb-entity-header__actions">
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/world/new`}
            >
              New Entity
            </Link>
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/sessions/new`}
            >
              New Session
            </Link>
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/threads/new`}
            >
              New Plot Thread
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
