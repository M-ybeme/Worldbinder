import type { CampaignActivityItem, EntityType, WorldDate } from '@worldbinder/contracts'
import { Button, CardGrid, ErrorState, LoadingState } from '@worldbinder/ui'
import { DEFAULT_DASHBOARD_BACKDROP_CONFIG } from '@worldbinder/validation'
import { CalendarDays, GitBranch } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QuickCreateEntityDialog } from '../../entities/components/QuickCreateEntityDialog'
import { EntityTypeIcon } from '../../entities/lib/entityTypeIcons'
import { QuickCreateThreadDialog } from '../../plot-threads/components/QuickCreateThreadDialog'
import { QuickCreateSessionDialog } from '../../sessions/components/QuickCreateSessionDialog'
import { DashboardBackdrop } from '../components/DashboardBackdrop'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import { useCampaignDashboardQuery } from '../hooks/useCampaigns'
import '../campaigns.css'

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

// Reuses the same icons CampaignLayout's sidebar nav already uses for
// Sessions/Threads, for visual consistency across the app.
function ActivityIcon({ item }: { item: CampaignActivityItem }) {
  if (item.resourceType === 'entity' && item.entityType) {
    return <EntityTypeIcon type={item.entityType} />
  }
  if (item.resourceType === 'session') return <CalendarDays size={16} aria-hidden="true" />
  return <GitBranch size={16} aria-hidden="true" />
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
  const [entityDialogType, setEntityDialogType] = useState<EntityType | null>(null)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [threadDialogOpen, setThreadDialogOpen] = useState(false)

  return (
    <section>
      <QuickCreateEntityDialog
        campaignId={campaign.id}
        open={entityDialogType !== null}
        onClose={() => setEntityDialogType(null)}
        fixedType={entityDialogType ?? 'character'}
      />
      <QuickCreateSessionDialog
        campaignId={campaign.id}
        open={sessionDialogOpen}
        onClose={() => setSessionDialogOpen(false)}
      />
      <QuickCreateThreadDialog
        campaignId={campaign.id}
        open={threadDialogOpen}
        onClose={() => setThreadDialogOpen(false)}
      />
      {campaign.coverImageUrl && (
        <DashboardBackdrop
          imageUrl={campaign.coverImageUrl}
          config={campaign.dashboardBackdropJson ?? DEFAULT_DASHBOARD_BACKDROP_CONFIG}
        />
      )}
      <p>{campaign.description ?? 'No description yet.'}</p>
      {/* Reuses ProfilePage's key-value dl treatment rather than
          introducing a near-duplicate .wb-campaign-overview class — same
          shape (a handful of label/value pairs), no reason for its own
          styling. */}
      <dl className="status-panel">
        <dt>System</dt>
        {/* || not ?? — the create-campaign form submits an empty string,
            not null/undefined, for a blank optional field (its Zod schema
            has no .nullable() or empty-to-undefined transform), so ??
            alone left this dd silently blank. Found by an entry that
            visibly had no value in a real screenshot, not assumed. */}
        <dd>{campaign.systemName || '—'}</dd>
        <dt>Status</dt>
        <dd>{campaign.status}</dd>
        <dt>Your role</dt>
        <dd>{campaign.role}</dd>
        <dt>Current in-world date</dt>
        <dd>
          {dashboardQuery.isLoading
            ? '…'
            : (formatWorldDate(dashboard?.currentWorldDateJson) ?? '—')}
        </dd>
      </dl>

      {dashboardQuery.isLoading && <LoadingState label="Loading dashboard…" />}
      {dashboardQuery.isError && (
        <ErrorState
          message={dashboardQuery.error.message}
          onRetry={() => dashboardQuery.refetch()}
        />
      )}

      {!dashboardQuery.isLoading && !dashboardQuery.isError && (
        <CardGrid minItemWidth={320}>
          <div className="wb-dashboard-widget">
            <h2>Sessions</h2>
            <p>
              Upcoming:{' '}
              {dashboard?.upcomingSession ? (
                <Link to={`/app/campaign/${campaign.id}/sessions/${dashboard.upcomingSession.id}`}>
                  Session {dashboard.upcomingSession.sessionNumber}:{' '}
                  {dashboard.upcomingSession.title}
                </Link>
              ) : (
                'None scheduled'
              )}
            </p>
            <p>
              Last played:{' '}
              {dashboard?.lastPlayedSession ? (
                <Link
                  to={`/app/campaign/${campaign.id}/sessions/${dashboard.lastPlayedSession.id}`}
                >
                  Session {dashboard.lastPlayedSession.sessionNumber}:{' '}
                  {dashboard.lastPlayedSession.title}
                </Link>
              ) : (
                'None yet'
              )}
            </p>
          </div>

          <div className="wb-dashboard-widget">
            <h2>Active Plot Threads</h2>
            {dashboard && dashboard.activeThreads.length === 0 && <p>No active plot threads.</p>}
            <ul className="wb-relationship-list">
              {dashboard?.activeThreads.map((thread) => (
                <li key={thread.id}>
                  <Link to={`/app/campaign/${campaign.id}/threads/${thread.id}`}>
                    {thread.title}
                  </Link>
                  {thread.importance ? ` · ${thread.importance}` : ''}
                </li>
              ))}
            </ul>
          </div>

          <div className="wb-dashboard-widget">
            <h2>Favorites</h2>
            {dashboard && dashboard.favoriteEntities.length === 0 && <p>No favorites yet.</p>}
            <ul className="wb-relationship-list">
              {dashboard?.favoriteEntities.map((entity) => (
                <li key={entity.id} className="wb-dashboard-activity__item">
                  <EntityTypeIcon type={entity.entityType} />
                  <Link to={`/app/campaign/${campaign.id}/world/${entity.id}`}>{entity.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {dashboard && dashboard.neglectedThreads.length > 0 && (
            <div className="wb-dashboard-widget">
              <h2>Neglected Threads</h2>
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

          <div className="wb-dashboard-widget">
            <h2>Recent Activity</h2>
            {dashboard && dashboard.recentActivity.length === 0 && <p>Nothing yet.</p>}
            <ul className="wb-relationship-list">
              {dashboard?.recentActivity.map((item) => (
                <li key={`${item.resourceType}-${item.id}`} className="wb-dashboard-activity__item">
                  <ActivityIcon item={item} />
                  <Link to={activityLink(campaign.id, item)}>{item.title}</Link>
                  {` · ${item.resourceType.replace('_', ' ')}`}
                </li>
              ))}
            </ul>
          </div>

          <div className="wb-dashboard-widget">
            <h2>Quick Actions</h2>
            <div className="wb-entity-header__actions">
              <Button variant="secondary" onClick={() => setEntityDialogType('character')}>
                New Character
              </Button>
              <Button variant="secondary" onClick={() => setEntityDialogType('location')}>
                New Location
              </Button>
              <Button variant="secondary" onClick={() => setSessionDialogOpen(true)}>
                New Session
              </Button>
              <Button variant="secondary" onClick={() => setThreadDialogOpen(true)}>
                New Plot Thread
              </Button>
            </div>
          </div>
        </CardGrid>
      )}
    </section>
  )
}
