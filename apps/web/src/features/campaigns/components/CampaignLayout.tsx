import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  GitBranch,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { IconButton, Tooltip } from '@worldbinder/ui'
import { SearchOverlay } from '../../search/components/SearchOverlay'
import { useSearchOverlayStore } from '../../search/store/useSearchOverlayStore'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import './CampaignLayout.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'wb-sidebar-collapsed'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return ['wb-sidebar__link', isActive ? 'wb-sidebar__link--active' : ''].filter(Boolean).join(' ')
}

function loadCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    // Private browsing / storage disabled — default to expanded.
    return false
  }
}

/** A nav link that collapses to icon-only with a hover/focus tooltip
 * standing in for the now-hidden text label — the label stays in the DOM
 * (for CSS-only hide, not unmount) and `aria-label` keeps the accessible
 * name correct either way, so nothing regresses for assistive tech when
 * collapsed. */
function SidebarNavLink({
  to,
  end,
  icon,
  label,
  collapsed,
}: {
  to: string
  end?: boolean
  icon: ReactNode
  label: string
  collapsed: boolean
}) {
  const link = (
    <NavLink to={to} end={end} className={navLinkClass} aria-label={label}>
      {icon}
      <span className="wb-sidebar__link-label">{label}</span>
    </NavLink>
  )
  return collapsed ? (
    <Tooltip label={label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

/**
 * The campaign-scoped app shell — sidebar (primary nav: Dashboard/World/
 * Sessions/Threads/Maps/Search; secondary: Members/Settings/Import-Export)
 * + topbar (campaign name, search shortcut, help, account). Only mounted
 * for `/app/campaign/:id/*` routes, since sidebar content is inherently
 * campaign-scoped — the outer `App.tsx` shell (auth/account/status/help)
 * keeps its own lighter header, there being no campaign nav to show there.
 */
export function CampaignLayout() {
  const { campaign } = useCampaignOutletContext()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const openSearch = useSearchOverlayStore((state) => state.open)
  const [collapsed, setCollapsed] = useState(loadCollapsedPreference)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isSearchShortcut) return
      event.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openSearch])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // Private browsing / storage disabled — the toggle still works
        // for this session, it just won't persist across a reload.
      }
      return next
    })
  }

  const backLink = (
    <Link to="/app/campaigns" className="wb-sidebar__back" aria-label="All campaigns">
      <ArrowLeft size={14} aria-hidden="true" />
      {!collapsed && 'All campaigns'}
    </Link>
  )

  return (
    <div className="wb-campaign-layout">
      <aside
        className={['wb-sidebar', collapsed ? 'wb-sidebar--collapsed' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="wb-sidebar__header">
          <div className="wb-sidebar__header-row">
            {collapsed ? (
              <Tooltip label="All campaigns" placement="right">
                {backLink}
              </Tooltip>
            ) : (
              backLink
            )}
            <IconButton
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
            </IconButton>
          </div>
          {!collapsed && <CampaignSwitcher currentCampaignId={campaign.id} />}
        </div>

        <nav className="wb-sidebar__nav" aria-label="Campaign">
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}`}
            end
            icon={<LayoutDashboard size={16} aria-hidden="true" />}
            label="Dashboard"
            collapsed={collapsed}
          />
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/world`}
            icon={<Globe size={16} aria-hidden="true" />}
            label="World"
            collapsed={collapsed}
          />
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/sessions`}
            icon={<CalendarDays size={16} aria-hidden="true" />}
            label="Sessions"
            collapsed={collapsed}
          />
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/threads`}
            icon={<GitBranch size={16} aria-hidden="true" />}
            label="Threads"
            collapsed={collapsed}
          />
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/maps`}
            icon={<Map size={16} aria-hidden="true" />}
            label="Maps"
            collapsed={collapsed}
          />
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/search`}
            icon={<Search size={16} aria-hidden="true" />}
            label="Search"
            collapsed={collapsed}
          />
        </nav>

        <nav
          className="wb-sidebar__nav wb-sidebar__nav--secondary"
          aria-label="Campaign management"
        >
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/members`}
            icon={<Users size={16} aria-hidden="true" />}
            label="Members"
            collapsed={collapsed}
          />
          {canManage && (
            <SidebarNavLink
              to={`/app/campaign/${campaign.id}/settings`}
              icon={<Settings size={16} aria-hidden="true" />}
              label="Settings"
              collapsed={collapsed}
            />
          )}
          {canManage && (
            <SidebarNavLink
              to={`/app/campaign/${campaign.id}/audit`}
              icon={<ScrollText size={16} aria-hidden="true" />}
              label="Audit Log"
              collapsed={collapsed}
            />
          )}
          <SidebarNavLink
            to={`/app/campaign/${campaign.id}/import-export`}
            icon={<ArrowLeftRight size={16} aria-hidden="true" />}
            label="Import / Export"
            collapsed={collapsed}
          />
        </nav>
      </aside>

      <div className="wb-campaign-layout__main">
        <header className="wb-topbar">
          <h1 className="wb-topbar__title">{campaign.name}</h1>
          <div className="wb-topbar__actions">
            <IconButton label="Search (Ctrl/Cmd+K)" onClick={openSearch}>
              <Search size={18} aria-hidden="true" />
            </IconButton>
            <Link to="/help" className="wb-icon-button" aria-label="Help">
              <HelpCircle size={18} aria-hidden="true" />
            </Link>
            <Link to="/account/profile" className="wb-icon-button" aria-label="Account">
              <User size={18} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main className="wb-campaign-layout__content">
          <Outlet context={{ campaign }} />
        </main>
      </div>

      <SearchOverlay campaignId={campaign.id} />
    </div>
  )
}
