import type { CampaignStatus, EntityType } from '@worldbinder/contracts'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '@worldbinder/ui'
import { DEFAULT_DASHBOARD_BACKDROP_CONFIG } from '@worldbinder/validation'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QuickCreateEntityDialog } from '../../entities/components/QuickCreateEntityDialog'
import { QuickCreateThreadDialog } from '../../plot-threads/components/QuickCreateThreadDialog'
import { QuickCreateSessionDialog } from '../../sessions/components/QuickCreateSessionDialog'
import { DashboardBackdrop } from '../components/DashboardBackdrop'
import { NewMenu, type NewMenuItem } from '../components/NewMenu'
import { RecentPanel } from '../components/dashboard/RecentPanel'
import { SessionPanel } from '../components/dashboard/SessionPanel'
import { SetupChecklist } from '../components/dashboard/SetupChecklist'
import { ThreadsPanel } from '../components/dashboard/ThreadsPanel'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import { useCampaignDashboardQuery } from '../hooks/useCampaigns'
import { describeNextSession, formatWorldDate, isSetupPhase } from '../lib/dashboardFormat'
import '../campaigns.css'
import '../components/dashboard/dashboard.css'

// Same role sets the World/Sessions/Threads pages use for their own
// "New" buttons — the API rejects creates from players and viewers.
const CREATE_ROLES = new Set(['owner', 'gm', 'editor'])
const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  hiatus: 'On hiatus',
  completed: 'Completed',
  archived: 'Archived',
}

type EntityDialog = { open: false } | { open: true; fixedType?: EntityType }

/**
 * The campaign Dashboard ("Dashboard E"): the next session leads, with the
 * last session's recap and the plot threads that need attention beneath
 * it, and recent changes and favorites in a narrow secondary column. A
 * campaign that hasn't played a session yet gets a setup checklist (for
 * owners/GMs) built from the app's existing actions. Everything comes from
 * the dashboard query plus each session's own detail query; both apply the
 * API's visibility rules, so nothing GM-only reaches a player here.
 */
export function CampaignOverviewPage() {
  const { campaign } = useCampaignOutletContext()
  const dashboardQuery = useCampaignDashboardQuery(campaign.id)
  const dashboard = dashboardQuery.data
  const canCreate = CREATE_ROLES.has(campaign.role)
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const [entityDialog, setEntityDialog] = useState<EntityDialog>({ open: false })
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [threadDialogOpen, setThreadDialogOpen] = useState(false)

  const openEntity = (fixedType?: EntityType) => setEntityDialog({ open: true, fixedType })
  const openSession = () => setSessionDialogOpen(true)
  const openThread = () => setThreadDialogOpen(true)

  const newItems: NewMenuItem[] = [
    { label: 'Character', onSelect: () => openEntity('character') },
    { label: 'Location', onSelect: () => openEntity('location') },
    { label: 'Other entry…', onSelect: () => openEntity() },
    { label: 'Session', onSelect: openSession },
    { label: 'Plot thread', onSelect: openThread },
  ]

  const worldDate = formatWorldDate(dashboard?.currentWorldDateJson)
  const isEmptyCampaign =
    dashboard !== undefined &&
    dashboard.upcomingSession === null &&
    dashboard.lastPlayedSession === null &&
    dashboard.activeThreads.length === 0 &&
    dashboard.neglectedThreads.length === 0 &&
    dashboard.recentActivity.length === 0 &&
    dashboard.favoriteEntities.length === 0
  const showChecklist = dashboard !== undefined && canManage && isSetupPhase(dashboard)

  const checklist = dashboard && showChecklist && (
    <SetupChecklist
      campaign={campaign}
      dashboard={dashboard}
      onNewEntity={openEntity}
      onPlanSession={openSession}
    />
  )

  return (
    <section className="wb-campaign-overview">
      <QuickCreateEntityDialog
        campaignId={campaign.id}
        open={entityDialog.open}
        onClose={() => setEntityDialog({ open: false })}
        fixedType={entityDialog.open ? entityDialog.fixedType : undefined}
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
          className="wb-dashboard-backdrop--ambient"
        />
      )}

      <div className="wb-dashboard-content wb-dash">
        <PageHeader
          title={campaign.name}
          meta={
            <>
              {campaign.status !== 'active' && <Badge>{STATUS_LABELS[campaign.status]}</Badge>}
              {campaign.systemName && <span>{campaign.systemName}</span>}
              {worldDate && (
                <span>
                  In-world: <strong className="wb-dash-strong">{worldDate}</strong>
                </span>
              )}
              {dashboard && (
                <span>
                  {dashboard.upcomingSession?.scheduledAt
                    ? describeNextSession(dashboard.upcomingSession.scheduledAt)
                    : 'No session scheduled'}
                </span>
              )}
            </>
          }
          actions={
            <>
              {!isEmptyCampaign && (
                <Link
                  className="wb-button wb-button--secondary"
                  to={`/app/campaign/${campaign.id}/world`}
                >
                  Browse the World
                </Link>
              )}
              {canCreate && <NewMenu items={newItems} />}
            </>
          }
        />
        {campaign.description && <p className="wb-dash-description">{campaign.description}</p>}

        {dashboardQuery.isLoading && <LoadingState label="Loading dashboard…" />}
        {dashboardQuery.isError && (
          <ErrorState
            message={dashboardQuery.error.message}
            onRetry={() => dashboardQuery.refetch()}
          />
        )}

        {dashboard && isEmptyCampaign && (
          <>
            {checklist}
            {!showChecklist && (
              <EmptyState
                message={
                  canCreate
                    ? 'Nothing here yet. Use New to add the first entries, sessions and plot threads.'
                    : 'Nothing here yet. Entries, sessions and plot threads appear here once your GM shares them.'
                }
              />
            )}
          </>
        )}

        {dashboard && !isEmptyCampaign && (
          <>
            {checklist}
            <div className="wb-dash-grid">
              <div className="wb-dash-main">
                <SessionPanel
                  campaignId={campaign.id}
                  upcoming={dashboard.upcomingSession}
                  last={dashboard.lastPlayedSession}
                  canEdit={canCreate}
                  neglectedCount={dashboard.neglectedThreads.length}
                  onPlanSession={canCreate ? openSession : null}
                />
                <ThreadsPanel
                  campaignId={campaign.id}
                  activeThreads={dashboard.activeThreads}
                  neglectedThreads={dashboard.neglectedThreads}
                  onNewThread={canCreate ? openThread : null}
                />
              </div>
              <RecentPanel
                campaignId={campaign.id}
                recentActivity={dashboard.recentActivity}
                favoriteEntities={dashboard.favoriteEntities}
                canViewAuditLog={canManage}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
