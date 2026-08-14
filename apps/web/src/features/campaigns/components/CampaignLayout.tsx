import { useEffect } from 'react'
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
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { IconButton } from '@worldbinder/ui'
import { SearchOverlay } from '../../search/components/SearchOverlay'
import { useSearchOverlayStore } from '../../search/store/useSearchOverlayStore'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import './CampaignLayout.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return ['wb-sidebar__link', isActive ? 'wb-sidebar__link--active' : ''].filter(Boolean).join(' ')
}

/**
 * The campaign-scoped app shell — sidebar (primary nav: Dashboard/World/
 * Sessions/Threads/Maps/Search; secondary: Members/Settings/Import-Export)
 * + topbar (campaign name, search shortcut, help, account). Only mounted
 * for `/app/campaign/:id/*` routes, since sidebar content is inherently
 * campaign-scoped — the outer `App.tsx` shell (auth/account/status/help)
 * keeps its own lighter header, there being no campaign nav to show there.
 *
 * AuditPage is deliberately not in this nav — it's explicitly documented
 * (see AuditPage.tsx) as reached via a link from Settings, not the fixed
 * primary/secondary nav, matching the roadmap's own scope for it.
 */
export function CampaignLayout() {
  const { campaign } = useCampaignOutletContext()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const openSearch = useSearchOverlayStore((state) => state.open)

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

  return (
    <div className="wb-campaign-layout">
      <aside className="wb-sidebar">
        <div className="wb-sidebar__header">
          <Link to="/app/campaigns" className="wb-sidebar__back">
            <ArrowLeft size={14} aria-hidden="true" />
            All campaigns
          </Link>
          <CampaignSwitcher currentCampaignId={campaign.id} />
        </div>

        <nav className="wb-sidebar__nav" aria-label="Campaign">
          <NavLink to={`/app/campaign/${campaign.id}`} end className={navLinkClass}>
            <LayoutDashboard size={16} aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink to={`/app/campaign/${campaign.id}/world`} className={navLinkClass}>
            <Globe size={16} aria-hidden="true" />
            World
          </NavLink>
          <NavLink to={`/app/campaign/${campaign.id}/sessions`} className={navLinkClass}>
            <CalendarDays size={16} aria-hidden="true" />
            Sessions
          </NavLink>
          <NavLink to={`/app/campaign/${campaign.id}/threads`} className={navLinkClass}>
            <GitBranch size={16} aria-hidden="true" />
            Threads
          </NavLink>
          <NavLink to={`/app/campaign/${campaign.id}/maps`} className={navLinkClass}>
            <Map size={16} aria-hidden="true" />
            Maps
          </NavLink>
          <NavLink to={`/app/campaign/${campaign.id}/search`} className={navLinkClass}>
            <Search size={16} aria-hidden="true" />
            Search
          </NavLink>
        </nav>

        <nav
          className="wb-sidebar__nav wb-sidebar__nav--secondary"
          aria-label="Campaign management"
        >
          <NavLink to={`/app/campaign/${campaign.id}/members`} className={navLinkClass}>
            <Users size={16} aria-hidden="true" />
            Members
          </NavLink>
          {canManage && (
            <NavLink to={`/app/campaign/${campaign.id}/settings`} className={navLinkClass}>
              <Settings size={16} aria-hidden="true" />
              Settings
            </NavLink>
          )}
          <NavLink to={`/app/campaign/${campaign.id}/import-export`} className={navLinkClass}>
            <ArrowLeftRight size={16} aria-hidden="true" />
            Import / Export
          </NavLink>
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
