import type { CampaignDetail, CampaignRole } from '@worldbinder/contracts'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchOverlayStore } from '../../search/store/useSearchOverlayStore'
import { CampaignLayout } from './CampaignLayout'

// Both fetch through TanStack Query; neither is what these tests are about.
vi.mock('./CampaignSwitcher', () => ({
  CampaignSwitcher: () => <select aria-label="Switch campaign" />,
}))
vi.mock('../../search/components/SearchOverlay', () => ({
  SearchOverlay: () => null,
}))

function makeCampaign(role: CampaignRole): CampaignDetail {
  return {
    id: 'c1',
    name: 'The Ashen Frontier',
    slug: 'the-ashen-frontier',
    description: null,
    systemName: null,
    status: 'active',
    role,
    coverImageUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    settingsJson: null,
    currentWorldDateJson: null,
    calendarConfigJson: null,
    dashboardBackdropJson: null,
  }
}

function renderShell({ role = 'owner', path = '/app/campaign/c1' } = {}) {
  const campaign = makeCampaign(role as CampaignRole)
  const page = (name: string) => <p>{name} page</p>
  const router = createMemoryRouter(
    [
      {
        path: '/app/campaign/:campaignId',
        element: <Outlet context={{ campaign }} />,
        children: [
          {
            element: <CampaignLayout />,
            children: [
              { index: true, element: page('Dashboard') },
              { path: 'world', element: page('World') },
              { path: 'world/timeline', element: page('Timeline') },
              { path: 'world/:entityId', element: page('Entity') },
              { path: 'sessions', element: page('Sessions') },
              { path: 'tags', element: page('Tags') },
              { path: 'settings', element: page('Settings') },
            ],
          },
        ],
      },
      { path: '/help', element: page('Help') },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function stubViewport(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: narrow,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

const campaignNav = () => screen.getByRole('navigation', { name: 'Campaign' })
const manageNav = () => screen.getByRole('navigation', { name: 'Campaign management' })

describe('CampaignLayout shell', () => {
  beforeEach(() => {
    localStorage.clear()
    useSearchOverlayStore.getState().close()
    stubViewport(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the five primary sections and marks the current one', () => {
    renderShell({ path: '/app/campaign/c1/world/e1' })
    const links = within(campaignNav()).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Dashboard',
      'World',
      'Sessions',
      'Threads',
      'Maps',
    ])
    expect(within(campaignNav()).getByRole('link', { name: 'World' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(campaignNav()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('has no search nav link — one search button opens the overlay instead', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Search (Ctrl/Cmd+K)' }))
    expect(useSearchOverlayStore.getState().isOpen).toBe(true)
  })

  it('keeps the Ctrl/Cmd+K shortcut', () => {
    renderShell()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(useSearchOverlayStore.getState().isOpen).toBe(true)
  })

  it('shows owners/GMs Settings and Audit Log, and everyone Members and Import / Export', () => {
    renderShell({ role: 'gm' })
    expect(
      within(manageNav())
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['Members', 'Settings', 'Audit Log', 'Import / Export'])
  })

  it('keeps Import / Export reachable for players but hides Settings and Audit Log', () => {
    renderShell({ role: 'player' })
    expect(
      within(manageNav())
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['Members', 'Import / Export'])
  })

  it('marks Settings current on the Tags page it links to', () => {
    renderShell({ path: '/app/campaign/c1/tags' })
    expect(within(manageNav()).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('keeps Help and Account links and the campaign switcher', () => {
    renderShell()
    const footer = screen.getByRole('navigation', { name: 'Help and account' })
    expect(within(footer).getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
    expect(within(footer).getByRole('link', { name: 'Account' })).toHaveAttribute(
      'href',
      '/account/profile',
    )
    expect(screen.getByLabelText('Switch campaign')).toBeInTheDocument()
  })

  it('no longer renders a topbar heading — pages own their h1', () => {
    renderShell()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('collapses to a rail, persists the preference, and restores it on the next mount', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(localStorage.getItem('wb-sidebar-collapsed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    // Labels stay as accessible names even though the visible text is hidden.
    expect(within(campaignNav()).getByRole('link', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Switch campaign')).not.toBeInTheDocument()
  })

  it('starts collapsed when the stored preference says so', () => {
    localStorage.setItem('wb-sidebar-collapsed', 'true')
    renderShell()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('shows a tooltip for a collapsed link on keyboard focus', () => {
    localStorage.setItem('wb-sidebar-collapsed', 'true')
    renderShell()
    fireEvent.focus(within(campaignNav()).getByRole('link', { name: 'Threads' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Threads')
  })

  it('sets a document title from the current section', async () => {
    const router = renderShell()
    expect(document.title).toBe('The Ashen Frontier · Worldbinder')
    await act(() => router.navigate('/app/campaign/c1/world/timeline'))
    expect(document.title).toBe('Timeline · The Ashen Frontier · Worldbinder')
  })

  describe('at tablet width and below', () => {
    beforeEach(() => stubViewport(true))

    it('ignores the collapsed preference and hides the drawer until opened', () => {
      localStorage.setItem('wb-sidebar-collapsed', 'true')
      renderShell({ path: '/app/campaign/c1/sessions' })
      const sidebar = document.getElementById('wb-campaign-sidebar')!
      expect(sidebar).toHaveAttribute('inert')
      expect(sidebar).not.toHaveClass('wb-sidebar--collapsed')
      expect(screen.queryByRole('button', { name: /sidebar/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    })

    it('opens the drawer as a modal dialog and closes it with Escape, returning focus', () => {
      renderShell({ path: '/app/campaign/c1/sessions' })
      const menuButton = screen.getByRole('button', { name: 'Open navigation' })
      fireEvent.click(menuButton)
      const drawer = screen.getByRole('dialog', { name: 'Navigation' })
      expect(drawer).not.toHaveAttribute('inert')
      expect(drawer).toContainElement(document.activeElement as HTMLElement)
      expect(screen.getByRole('main').parentElement).toHaveAttribute('inert')

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(menuButton).toHaveFocus()
    })

    it('closes the drawer after following a link', () => {
      renderShell({ path: '/app/campaign/c1/sessions' })
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
      fireEvent.click(within(campaignNav()).getByRole('link', { name: 'World' }))
      expect(screen.getByText('World page')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows bottom tabs for the primary sections and the section in the top bar', () => {
      renderShell({ path: '/app/campaign/c1/sessions' })
      const tabs = screen.getByRole('navigation', { name: 'Campaign sections' })
      expect(within(tabs).getByRole('link', { name: 'Sessions' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(within(tabs).getAllByRole('link')).toHaveLength(5)
      expect(screen.getByRole('banner')).toHaveTextContent('Sessions')
    })
  })
})
