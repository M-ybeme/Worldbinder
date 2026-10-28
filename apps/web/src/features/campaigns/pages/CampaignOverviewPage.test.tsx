import type {
  CampaignDashboard,
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntitySummary,
  PlotThreadSummary,
} from '@worldbinder/contracts'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignOverviewPage } from './CampaignOverviewPage'

// --- Data hooks: each test sets what the API "returned". ------------------

let dashboardResult: { data?: CampaignDashboard; isLoading?: boolean; isError?: boolean; error?: Error }
let sessionDetails: Record<string, CampaignSessionDetail>
let memberCount: number

vi.mock('../hooks/useCampaigns', () => ({
  useCampaignDashboardQuery: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...dashboardResult,
  }),
}))
vi.mock('../../sessions/hooks/useSessions', () => ({
  useSessionQuery: (_campaignId: string, sessionId: string) => ({
    data: sessionDetails[sessionId],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))
vi.mock('../../membership/hooks/useCampaignMembers', () => ({
  useMembersQuery: () => ({ data: Array.from({ length: memberCount }, (_, i) => ({ id: `m${i}` })) }),
}))

// The quick-create dialogs have their own tests; here only which one opens
// (and with which entity type) matters.
vi.mock('../../entities/components/QuickCreateEntityDialog', () => ({
  QuickCreateEntityDialog: ({ open, fixedType }: { open: boolean; fixedType?: string }) =>
    open ? <div role="dialog" aria-label={`New entity: ${fixedType ?? 'any type'}`} /> : null,
}))
vi.mock('../../sessions/components/QuickCreateSessionDialog', () => ({
  QuickCreateSessionDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="New session" /> : null,
}))
vi.mock('../../plot-threads/components/QuickCreateThreadDialog', () => ({
  QuickCreateThreadDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="New plot thread" /> : null,
}))

// --- Fixtures --------------------------------------------------------------

const DAY = 86_400_000
const STAMP = '2026-10-01T12:00:00.000Z'

function makeCampaign(role: CampaignRole, overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    name: 'The Ember Coast',
    slug: 'the-ember-coast',
    description: 'A frontier of burned forts.',
    systemName: 'D&D 5e',
    status: 'active',
    role,
    coverImageUrl: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    archivedAt: null,
    settingsJson: null,
    currentWorldDateJson: null,
    calendarConfigJson: null,
    dashboardBackdropJson: null,
    ...overrides,
  }
}

function session(id: string, n: number, title: string, extra: Partial<CampaignSessionSummary> = {}): CampaignSessionSummary {
  return {
    id,
    campaignId: 'c1',
    sessionNumber: n,
    title,
    status: 'planned',
    scheduledAt: null,
    playedAt: null,
    worldStartDateJson: null,
    worldEndDateJson: null,
    visibility: 'public',
    tags: [],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  }
}

function entity(id: string, name: string, entityType: EntitySummary['entityType']): EntitySummary {
  return { id, name, entityType, campaignId: 'c1', slug: id, summary: null, aliases: [] } as unknown as EntitySummary
}

function thread(id: string, title: string, extra: Partial<PlotThreadSummary> = {}): PlotThreadSummary {
  return {
    id,
    campaignId: 'c1',
    title,
    summary: null,
    playerFacingStatus: 'ongoing',
    visibility: 'public',
    lastReferencedSession: null,
    neglected: false,
    tags: [],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  }
}

function detail(summary: CampaignSessionSummary, extra: Partial<CampaignSessionDetail> = {}): CampaignSessionDetail {
  return {
    ...summary,
    recapContentJson: null,
    participants: [],
    featuredEntities: [],
    locations: [],
    reveals: [],
    plotThreadChanges: [],
    ...extra,
  }
}

const caravan = thread('t1', 'The Missing Caravan', { importance: 'major' })
const debt = thread('t2', 'Duke Renald’s Debt', { importance: 'critical' })
const shrine = thread('t3', 'The Whispering Shrine', {
  neglected: true,
  lastReferencedSession: { id: 's1', sessionNumber: 1, title: 'Smoke' },
})
const mara = entity('e1', 'Captain Mara Voss', 'character')
const pass = entity('e2', 'Stonewater Pass', 'location')
const tunnels = entity('e3', 'Gatehouse Tunnels', 'location')
const blackwall = entity('e4', 'Blackwall', 'location')

function populatedDashboard(): CampaignDashboard {
  const upcoming = session('s6', 6, 'Into Stonewater Pass', {
    scheduledAt: new Date(Date.now() + 6 * DAY).toISOString(),
  })
  const last = session('s5', 5, 'The Siege of Blackwall', {
    status: 'completed',
    playedAt: '2026-10-19T19:00:00.000Z',
  })
  sessionDetails = {
    s6: detail(upcoming, {
      featuredEntities: [mara],
      locations: [pass, mara],
      plotThreadChanges: [{ plotThread: caravan, action: 'advanced' }],
    }),
    s5: detail(last, {
      recapContentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The gate held, barely.' }] }],
      },
      reveals: [tunnels],
      plotThreadChanges: [{ plotThread: debt, action: 'advanced' }],
    }),
  }
  return {
    currentWorldDateJson: { schemaVersion: 1, year: 1287, month: 11, day: 14, label: '14 Frostfall, 1287 AR' },
    status: 'active',
    upcomingSession: upcoming,
    lastPlayedSession: last,
    activeThreads: [caravan, debt, shrine],
    neglectedThreads: [shrine],
    recentActivity: [
      { resourceType: 'entity', id: 'e1', title: 'Captain Mara Voss', updatedAt: STAMP, entityType: 'character' },
      { resourceType: 'session', id: 's6', title: 'Session 6: Into Stonewater Pass', updatedAt: STAMP },
    ],
    favoriteEntities: [blackwall],
    hasEntities: true,
    hasSessions: true,
  }
}

function emptyDashboard(): CampaignDashboard {
  return {
    currentWorldDateJson: null,
    status: 'draft',
    upcomingSession: null,
    lastPlayedSession: null,
    activeThreads: [],
    neglectedThreads: [],
    recentActivity: [],
    favoriteEntities: [],
    hasEntities: false,
    hasSessions: false,
  }
}

function renderDashboard(campaign: CampaignDetail) {
  const router = createMemoryRouter(
    [
      {
        path: '/app/campaign/:campaignId',
        element: <Outlet context={{ campaign }} />,
        children: [{ index: true, element: <CampaignOverviewPage /> }],
      },
    ],
    { initialEntries: ['/app/campaign/c1'] },
  )
  render(<RouterProvider router={router} />)
}

const link = (name: string | RegExp) => screen.getByRole('link', { name })

beforeEach(() => {
  dashboardResult = {}
  sessionDetails = {}
  memberCount = 1
})

describe('Dashboard E — populated campaign', () => {
  beforeEach(() => {
    dashboardResult = { data: populatedDashboard() }
  })

  it('leads with the campaign header: name, context, next-session indicator', () => {
    renderDashboard(makeCampaign('gm'))
    expect(screen.getByRole('heading', { level: 1, name: 'The Ember Coast' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('14 Frostfall, 1287 AR')).toBeInTheDocument()
    expect(screen.getByText('Next session in 6 days')).toBeInTheDocument()
    expect(screen.getByText('D&D 5e')).toBeInTheDocument()
    expect(link('Browse the World')).toHaveAttribute('href', '/app/campaign/c1/world')
  })

  it('shows the upcoming session with its threads, featured entries and prep link', () => {
    renderDashboard(makeCampaign('gm'))
    expect(screen.getByRole('heading', { level: 3, name: 'Session 6 — Into Stonewater Pass' })).toBeInTheDocument()
    const threads = screen.getByRole('heading', { name: 'Plot threads in this session' }).nextElementSibling!
    expect(within(threads as HTMLElement).getByRole('link', { name: 'The Missing Caravan' })).toBeInTheDocument()
    const featured = screen.getByRole('heading', { name: 'Featured in this session' }).nextElementSibling!
    // Mara is both featured and a location link — listed once.
    expect(within(featured as HTMLElement).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Captain Mara Voss',
      'Stonewater Pass',
    ])
    expect(link('Open session prep')).toHaveAttribute('href', '/app/campaign/c1/sessions/s6')
    expect(link('Edit session')).toHaveAttribute('href', '/app/campaign/c1/sessions/s6/edit')
  })

  it('recaps the last session with its developments', () => {
    renderDashboard(makeCampaign('gm'))
    expect(link('Session 5 — The Siege of Blackwall')).toHaveAttribute('href', '/app/campaign/c1/sessions/s5')
    expect(screen.getByText('The gate held, barely.')).toBeInTheDocument()
    expect(link('Gatehouse Tunnels')).toHaveAttribute('href', '/app/campaign/c1/world/e3')
    expect(link(/Duke Renald’s Debt · advanced/)).toBeInTheDocument()
  })

  it('pulls neglected threads into "Needs attention" without repeating them', () => {
    renderDashboard(makeCampaign('gm'))
    const attention = screen.getByRole('heading', { name: /Needs attention/ }).nextElementSibling!
    expect(within(attention as HTMLElement).getByRole('link', { name: 'The Whispering Shrine' })).toBeInTheDocument()
    expect(within(attention as HTMLElement).getByText('last in Session 1')).toBeInTheDocument()
    const others = screen.getByRole('list', { name: 'Other active threads' })
    expect(within(others).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'The Missing Caravan',
      'Duke Renald’s Debt',
    ])
    expect(within(others).getByText('Critical')).toBeInTheDocument()
    expect(link('All threads')).toHaveAttribute('href', '/app/campaign/c1/threads')
  })

  it('lists recent changes and favorites in the secondary column', () => {
    renderDashboard(makeCampaign('gm'))
    const aside = screen.getByRole('complementary', { name: 'Recent and favorites' })
    expect(within(aside).getByRole('link', { name: 'Session 6: Into Stonewater Pass' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/sessions/s6',
    )
    expect(within(aside).getByRole('link', { name: 'Blackwall' })).toHaveAttribute('href', '/app/campaign/c1/world/e4')
    expect(within(aside).getByRole('link', { name: 'Full activity log' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/audit',
    )
  })

  it('shows no setup checklist once a session has been played', () => {
    renderDashboard(makeCampaign('owner'))
    expect(screen.queryByRole('heading', { name: 'Get the campaign ready' })).not.toBeInTheDocument()
  })

  it('gives players read-only access: no New menu, edit links or GM-only activity log', () => {
    // What the API returns for a player: importance omitted.
    const data = populatedDashboard()
    data.activeThreads = data.activeThreads.map((t) => {
      const copy = { ...t }
      delete copy.importance
      return copy
    })
    dashboardResult = { data }
    renderDashboard(makeCampaign('player'))
    expect(screen.queryByRole('button', { name: /New/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Full activity log' })).not.toBeInTheDocument()
    expect(screen.queryByText('Critical')).not.toBeInTheDocument()
    expect(link('Open session prep')).toBeInTheDocument()
  })
})

describe('Dashboard E — the + New menu', () => {
  beforeEach(() => {
    dashboardResult = { data: populatedDashboard() }
  })

  it('opens from the keyboard, moves with arrows, and Escape returns focus', () => {
    renderDashboard(makeCampaign('editor'))
    const button = screen.getByRole('button', { name: 'New' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    const menu = screen.getByRole('menu', { name: 'Create new' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Character',
      'Location',
      'Other entry…',
      'Session',
      'Plot thread',
    ])
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(items[4]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it.each([
    ['Character', 'New entity: character'],
    ['Location', 'New entity: location'],
    ['Other entry…', 'New entity: any type'],
    ['Session', 'New session'],
    ['Plot thread', 'New plot thread'],
  ])('“%s” opens the existing quick-create dialog', (item, dialog) => {
    renderDashboard(makeCampaign('gm'))
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(screen.getByRole('menuitem', { name: item }))
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('Dashboard E — no upcoming session', () => {
  beforeEach(() => {
    const data = populatedDashboard()
    data.upcomingSession = null
    dashboardResult = { data }
  })

  it('says so, offers to plan one, and points at neglected threads', () => {
    renderDashboard(makeCampaign('gm'))
    expect(screen.getByRole('heading', { name: 'No session scheduled' })).toBeInTheDocument()
    expect(screen.getAllByText('No session scheduled').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 thread is waiting to be picked up/)).toBeInTheDocument()
    expect(link('See neglected threads')).toHaveAttribute(
      'href',
      '/app/campaign/c1/threads?status=neglected',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Plan next session' }))
    expect(screen.getByRole('dialog', { name: 'New session' })).toBeInTheDocument()
  })

  it('does not offer planning to players', () => {
    renderDashboard(makeCampaign('viewer'))
    expect(screen.queryByRole('button', { name: 'Plan next session' })).not.toBeInTheDocument()
  })
})

describe('Dashboard E — empty sections', () => {
  it('shows empty states for threads, activity and favorites', () => {
    const data = populatedDashboard()
    data.activeThreads = []
    data.neglectedThreads = []
    data.recentActivity = []
    data.favoriteEntities = []
    dashboardResult = { data }
    renderDashboard(makeCampaign('editor'))
    expect(screen.getByText('No active plot threads.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New plot thread' }))
    expect(screen.getByRole('dialog', { name: 'New plot thread' })).toBeInTheDocument()
    expect(screen.getByText('Nothing has changed yet.')).toBeInTheDocument()
    expect(screen.getByText('Star an entry in the World to pin it here.')).toBeInTheDocument()
  })
})

describe('Dashboard E — new campaign', () => {
  beforeEach(() => {
    dashboardResult = { data: emptyDashboard() }
  })

  it('gives owners a setup checklist built from existing actions', () => {
    renderDashboard(makeCampaign('owner', { status: 'draft' }))
    expect(screen.getByRole('heading', { name: 'Get the campaign ready' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      'Add the first people and places',
      'Plan your first session',
      'Invite your players',
      'Set up the calendar (optional)',
    ])
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse the World' })).not.toBeInTheDocument()
    expect(link('Invite players')).toHaveAttribute('href', '/app/campaign/c1/members')
    expect(link('Calendar settings')).toHaveAttribute('href', '/app/campaign/c1/settings')
    expect(link('Import a campaign file')).toHaveAttribute('href', '/app/campaigns/import')

    fireEvent.click(screen.getByRole('button', { name: 'New character' }))
    expect(screen.getByRole('dialog', { name: 'New entity: character' })).toBeInTheDocument()
  })

  it('drops steps that the campaign has already done', () => {
    memberCount = 3
    dashboardResult = {
      data: {
        ...emptyDashboard(),
        hasEntities: true,
        recentActivity: [
          { resourceType: 'entity', id: 'e1', title: 'Captain Mara Voss', updatedAt: STAMP, entityType: 'character' },
        ],
      },
    }
    renderDashboard(
      makeCampaign('gm', {
        calendarConfigJson: { schemaVersion: 1 } as unknown as CampaignDetail['calendarConfigJson'],
      }),
    )
    const titles = within(screen.getByRole('region', { name: 'Get the campaign ready' }))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual(['Plan your first session'])
  })

  it('trusts the existence checks, not recent activity — older entries still count', () => {
    // An established-but-unplayed campaign: lots of recent thread edits have
    // pushed every entry and session out of the 10-item activity feed.
    memberCount = 1
    dashboardResult = {
      data: {
        ...emptyDashboard(),
        hasEntities: true,
        hasSessions: true,
        activeThreads: [caravan],
        recentActivity: Array.from({ length: 10 }, (_, i) => ({
          resourceType: 'plot_thread' as const,
          id: `t${i}`,
          title: `Thread ${i}`,
          updatedAt: STAMP,
        })),
      },
    }
    renderDashboard(makeCampaign('owner'))
    const titles = within(screen.getByRole('region', { name: 'Get the campaign ready' }))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual(['Invite your players', 'Set up the calendar (optional)'])
  })

  it('treats a campaign with only older content as not empty', () => {
    dashboardResult = { data: { ...emptyDashboard(), hasEntities: true } }
    renderDashboard(makeCampaign('player'))
    expect(screen.queryByText(/once your GM shares them/)).not.toBeInTheDocument()
    expect(link('Browse the World')).toBeInTheDocument()
  })

  it('hides the checklist when every required step is done, even without a calendar', () => {
    memberCount = 2
    dashboardResult = { data: { ...emptyDashboard(), hasEntities: true, hasSessions: true } }
    renderDashboard(makeCampaign('owner'))
    expect(screen.queryByRole('heading', { name: 'Get the campaign ready' })).not.toBeInTheDocument()
  })

  it('shows players an empty state instead of the checklist', () => {
    renderDashboard(makeCampaign('player'))
    expect(screen.queryByRole('heading', { name: 'Get the campaign ready' })).not.toBeInTheDocument()
    expect(screen.getByText(/once your GM shares them/)).toBeInTheDocument()
  })
})

describe('Dashboard E — loading and errors', () => {
  it('keeps the header while the dashboard loads', () => {
    dashboardResult = { isLoading: true }
    renderDashboard(makeCampaign('gm'))
    expect(screen.getByRole('heading', { level: 1, name: 'The Ember Coast' })).toBeInTheDocument()
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  })

  it('shows an error with a retry', () => {
    dashboardResult = { isError: true, error: new Error('Network down') }
    renderDashboard(makeCampaign('gm'))
    expect(screen.getByText('Network down')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
