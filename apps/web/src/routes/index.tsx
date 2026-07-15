import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app/App'
import { AccountLayout } from '../features/account/components/AccountLayout'
import { RedirectIfAuthenticated } from '../features/auth/components/RedirectIfAuthenticated'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { CampaignLayout } from '../features/campaigns/components/CampaignLayout'
import { RequireCampaignMembership } from '../features/campaigns/components/RequireCampaignMembership'
import { StatusPage } from '../features/system-status/pages/StatusPage'

// Milestone 14 Phase 7 — every leaf page is loaded via react-router's
// `lazy` route property instead of a static top-level import, so none of
// them (TipTap-heavy entity/session/thread/timeline pages and map pages
// especially) are in the initial bundle. Layout/guard components above
// stay eager — they're small, and the app shell itself isn't "campaign
// content" the roadmap's §22.1 says to avoid loading at startup. StatusPage
// (the `/` landing route) also stays eager so the very first paint doesn't
// need an extra chunk round-trip on top of the main bundle it needs anyway.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <StatusPage /> },
      {
        path: 'verify-email',
        lazy: () =>
          import('../features/auth/pages/VerifyEmailPage').then((m) => ({
            Component: m.VerifyEmailPage,
          })),
      },
      {
        path: 'help',
        lazy: () =>
          import('../features/help/pages/HelpPage').then((m) => ({
            Component: m.HelpPage,
          })),
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          {
            path: 'login',
            lazy: () =>
              import('../features/auth/pages/LoginPage').then((m) => ({
                Component: m.LoginPage,
              })),
          },
          {
            path: 'register',
            lazy: () =>
              import('../features/auth/pages/RegisterPage').then((m) => ({
                Component: m.RegisterPage,
              })),
          },
          {
            path: 'forgot-password',
            lazy: () =>
              import('../features/auth/pages/ForgotPasswordPage').then((m) => ({
                Component: m.ForgotPasswordPage,
              })),
          },
          {
            path: 'reset-password',
            lazy: () =>
              import('../features/auth/pages/ResetPasswordPage').then((m) => ({
                Component: m.ResetPasswordPage,
              })),
          },
        ],
      },
      {
        path: 'account',
        element: <RequireAuth />,
        children: [
          {
            element: <AccountLayout />,
            children: [
              {
                index: true,
                lazy: () =>
                  import('../features/account/pages/ProfilePage').then((m) => ({
                    Component: m.ProfilePage,
                  })),
              },
              {
                path: 'profile',
                lazy: () =>
                  import('../features/account/pages/ProfilePage').then((m) => ({
                    Component: m.ProfilePage,
                  })),
              },
              {
                path: 'security',
                lazy: () =>
                  import('../features/account/pages/SecurityPage').then((m) => ({
                    Component: m.SecurityPage,
                  })),
              },
              {
                path: 'sessions',
                lazy: () =>
                  import('../features/account/pages/SessionsPage').then((m) => ({
                    Component: m.SessionsPage,
                  })),
              },
            ],
          },
        ],
      },
      {
        path: 'app',
        element: <RequireAuth />,
        children: [
          {
            path: 'campaigns',
            lazy: () =>
              import('../features/campaigns/pages/CampaignsListPage').then((m) => ({
                Component: m.CampaignsListPage,
              })),
          },
          {
            path: 'campaigns/import',
            lazy: () =>
              import('../features/imports/pages/ImportCampaignPage').then((m) => ({
                Component: m.ImportCampaignPage,
              })),
          },
          {
            path: 'campaign/:campaignId',
            element: <RequireCampaignMembership />,
            children: [
              {
                element: <CampaignLayout />,
                children: [
                  {
                    index: true,
                    lazy: () =>
                      import('../features/campaigns/pages/CampaignOverviewPage').then(
                        (m) => ({ Component: m.CampaignOverviewPage }),
                      ),
                  },
                  {
                    path: 'settings',
                    lazy: () =>
                      import('../features/campaigns/pages/CampaignSettingsPage').then(
                        (m) => ({ Component: m.CampaignSettingsPage }),
                      ),
                  },
                  {
                    path: 'members',
                    lazy: () =>
                      import('../features/membership/pages/MembersPage').then((m) => ({
                        Component: m.MembersPage,
                      })),
                  },
                  {
                    path: 'world',
                    lazy: () =>
                      import('../features/entities/pages/WorldListPage').then((m) => ({
                        Component: m.WorldListPage,
                      })),
                  },
                  {
                    path: 'world/new',
                    lazy: () =>
                      import('../features/entities/pages/EntityFormPage').then((m) => ({
                        Component: m.EntityFormPage,
                      })),
                  },
                  {
                    path: 'world/:entityId',
                    lazy: () =>
                      import('../features/entities/pages/EntityDetailPage').then(
                        (m) => ({ Component: m.EntityDetailPage }),
                      ),
                  },
                  {
                    path: 'world/:entityId/edit',
                    lazy: () =>
                      import('../features/entities/pages/EntityFormPage').then((m) => ({
                        Component: m.EntityFormPage,
                      })),
                  },
                  {
                    path: 'world/timeline',
                    lazy: () =>
                      import('../features/timeline/pages/TimelineListPage').then(
                        (m) => ({ Component: m.TimelineListPage }),
                      ),
                  },
                  {
                    path: 'world/timeline/new',
                    lazy: () =>
                      import('../features/timeline/pages/TimelineEventFormPage').then(
                        (m) => ({ Component: m.TimelineEventFormPage }),
                      ),
                  },
                  {
                    path: 'world/timeline/:eventId',
                    lazy: () =>
                      import('../features/timeline/pages/TimelineEventDetailPage').then(
                        (m) => ({ Component: m.TimelineEventDetailPage }),
                      ),
                  },
                  {
                    path: 'world/timeline/:eventId/edit',
                    lazy: () =>
                      import('../features/timeline/pages/TimelineEventFormPage').then(
                        (m) => ({ Component: m.TimelineEventFormPage }),
                      ),
                  },
                  {
                    path: 'sessions',
                    lazy: () =>
                      import('../features/sessions/pages/SessionListPage').then(
                        (m) => ({ Component: m.SessionListPage }),
                      ),
                  },
                  {
                    path: 'sessions/new',
                    lazy: () =>
                      import('../features/sessions/pages/SessionFormPage').then(
                        (m) => ({ Component: m.SessionFormPage }),
                      ),
                  },
                  {
                    path: 'sessions/:sessionId',
                    lazy: () =>
                      import('../features/sessions/pages/SessionDetailPage').then(
                        (m) => ({ Component: m.SessionDetailPage }),
                      ),
                  },
                  {
                    path: 'sessions/:sessionId/edit',
                    lazy: () =>
                      import('../features/sessions/pages/SessionFormPage').then(
                        (m) => ({ Component: m.SessionFormPage }),
                      ),
                  },
                  {
                    path: 'threads',
                    lazy: () =>
                      import('../features/plot-threads/pages/ThreadListPage').then(
                        (m) => ({ Component: m.ThreadListPage }),
                      ),
                  },
                  {
                    path: 'threads/new',
                    lazy: () =>
                      import('../features/plot-threads/pages/ThreadFormPage').then(
                        (m) => ({ Component: m.ThreadFormPage }),
                      ),
                  },
                  {
                    path: 'threads/:threadId',
                    lazy: () =>
                      import('../features/plot-threads/pages/ThreadDetailPage').then(
                        (m) => ({ Component: m.ThreadDetailPage }),
                      ),
                  },
                  {
                    path: 'threads/:threadId/edit',
                    lazy: () =>
                      import('../features/plot-threads/pages/ThreadFormPage').then(
                        (m) => ({ Component: m.ThreadFormPage }),
                      ),
                  },
                  {
                    path: 'maps',
                    lazy: () =>
                      import('../features/maps/pages/MapListPage').then((m) => ({
                        Component: m.MapListPage,
                      })),
                  },
                  {
                    path: 'maps/new',
                    lazy: () =>
                      import('../features/maps/pages/MapFormPage').then((m) => ({
                        Component: m.MapFormPage,
                      })),
                  },
                  {
                    path: 'maps/:mapId',
                    lazy: () =>
                      import('../features/maps/pages/MapDetailPage').then((m) => ({
                        Component: m.MapDetailPage,
                      })),
                  },
                  {
                    path: 'maps/:mapId/edit',
                    lazy: () =>
                      import('../features/maps/pages/MapFormPage').then((m) => ({
                        Component: m.MapFormPage,
                      })),
                  },
                  {
                    path: 'search',
                    lazy: () =>
                      import('../features/search/pages/SearchResultsPage').then(
                        (m) => ({ Component: m.SearchResultsPage }),
                      ),
                  },
                  {
                    path: 'audit',
                    lazy: () =>
                      import('../features/audit/pages/AuditPage').then((m) => ({
                        Component: m.AuditPage,
                      })),
                  },
                  {
                    path: 'import-export',
                    lazy: () =>
                      import('../features/exports/pages/ExportsPage').then((m) => ({
                        Component: m.ExportsPage,
                      })),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'accept-invitation/:token',
        element: <RequireAuth />,
        children: [
          {
            index: true,
            lazy: () =>
              import('../features/membership/pages/AcceptInvitationPage').then(
                (m) => ({ Component: m.AcceptInvitationPage }),
              ),
          },
        ],
      },
    ],
  },
])
