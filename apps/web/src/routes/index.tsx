import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app/App'
import { AccountLayout } from '../features/account/components/AccountLayout'
import { ProfilePage } from '../features/account/pages/ProfilePage'
import { SecurityPage } from '../features/account/pages/SecurityPage'
import { SessionsPage } from '../features/account/pages/SessionsPage'
import { TimelineEventDetailPage } from '../features/timeline/pages/TimelineEventDetailPage'
import { TimelineEventFormPage } from '../features/timeline/pages/TimelineEventFormPage'
import { TimelineListPage } from '../features/timeline/pages/TimelineListPage'
import { AuditPage } from '../features/audit/pages/AuditPage'
import { ExportsPage } from '../features/exports/pages/ExportsPage'
import { ImportCampaignPage } from '../features/imports/pages/ImportCampaignPage'
import { RedirectIfAuthenticated } from '../features/auth/components/RedirectIfAuthenticated'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage'
import { CampaignLayout } from '../features/campaigns/components/CampaignLayout'
import { RequireCampaignMembership } from '../features/campaigns/components/RequireCampaignMembership'
import { CampaignOverviewPage } from '../features/campaigns/pages/CampaignOverviewPage'
import { CampaignSettingsPage } from '../features/campaigns/pages/CampaignSettingsPage'
import { CampaignsListPage } from '../features/campaigns/pages/CampaignsListPage'
import { EntityDetailPage } from '../features/entities/pages/EntityDetailPage'
import { EntityFormPage } from '../features/entities/pages/EntityFormPage'
import { WorldListPage } from '../features/entities/pages/WorldListPage'
import { MapDetailPage } from '../features/maps/pages/MapDetailPage'
import { MapFormPage } from '../features/maps/pages/MapFormPage'
import { MapListPage } from '../features/maps/pages/MapListPage'
import { AcceptInvitationPage } from '../features/membership/pages/AcceptInvitationPage'
import { MembersPage } from '../features/membership/pages/MembersPage'
import { ThreadDetailPage } from '../features/plot-threads/pages/ThreadDetailPage'
import { ThreadFormPage } from '../features/plot-threads/pages/ThreadFormPage'
import { ThreadListPage } from '../features/plot-threads/pages/ThreadListPage'
import { SearchResultsPage } from '../features/search/pages/SearchResultsPage'
import { SessionDetailPage } from '../features/sessions/pages/SessionDetailPage'
import { SessionFormPage } from '../features/sessions/pages/SessionFormPage'
import { SessionListPage } from '../features/sessions/pages/SessionListPage'
import { StatusPage } from '../features/system-status/pages/StatusPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <StatusPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        path: 'account',
        element: <RequireAuth />,
        children: [
          {
            element: <AccountLayout />,
            children: [
              { index: true, element: <ProfilePage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'security', element: <SecurityPage /> },
              { path: 'sessions', element: <SessionsPage /> },
            ],
          },
        ],
      },
      {
        path: 'app',
        element: <RequireAuth />,
        children: [
          { path: 'campaigns', element: <CampaignsListPage /> },
          { path: 'campaigns/import', element: <ImportCampaignPage /> },
          {
            path: 'campaign/:campaignId',
            element: <RequireCampaignMembership />,
            children: [
              {
                element: <CampaignLayout />,
                children: [
                  { index: true, element: <CampaignOverviewPage /> },
                  { path: 'settings', element: <CampaignSettingsPage /> },
                  { path: 'members', element: <MembersPage /> },
                  { path: 'world', element: <WorldListPage /> },
                  { path: 'world/new', element: <EntityFormPage /> },
                  { path: 'world/:entityId', element: <EntityDetailPage /> },
                  { path: 'world/:entityId/edit', element: <EntityFormPage /> },
                  { path: 'world/timeline', element: <TimelineListPage /> },
                  { path: 'world/timeline/new', element: <TimelineEventFormPage /> },
                  { path: 'world/timeline/:eventId', element: <TimelineEventDetailPage /> },
                  { path: 'world/timeline/:eventId/edit', element: <TimelineEventFormPage /> },
                  { path: 'sessions', element: <SessionListPage /> },
                  { path: 'sessions/new', element: <SessionFormPage /> },
                  { path: 'sessions/:sessionId', element: <SessionDetailPage /> },
                  { path: 'sessions/:sessionId/edit', element: <SessionFormPage /> },
                  { path: 'threads', element: <ThreadListPage /> },
                  { path: 'threads/new', element: <ThreadFormPage /> },
                  { path: 'threads/:threadId', element: <ThreadDetailPage /> },
                  { path: 'threads/:threadId/edit', element: <ThreadFormPage /> },
                  { path: 'maps', element: <MapListPage /> },
                  { path: 'maps/new', element: <MapFormPage /> },
                  { path: 'maps/:mapId', element: <MapDetailPage /> },
                  { path: 'maps/:mapId/edit', element: <MapFormPage /> },
                  { path: 'search', element: <SearchResultsPage /> },
                  { path: 'audit', element: <AuditPage /> },
                  { path: 'import-export', element: <ExportsPage /> },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'accept-invitation/:token',
        element: <RequireAuth />,
        children: [{ index: true, element: <AcceptInvitationPage /> }],
      },
    ],
  },
])
