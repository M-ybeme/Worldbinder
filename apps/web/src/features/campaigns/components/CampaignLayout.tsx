import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { SearchOverlay } from '../../search/components/SearchOverlay'
import { useSearchOverlayStore } from '../../search/store/useSearchOverlayStore'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

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
    <div>
      <header className="wb-campaign-header">
        <Link to="/app/campaigns">All campaigns</Link>
        <CampaignSwitcher currentCampaignId={campaign.id} />
        <h1>{campaign.name}</h1>
      </header>
      <nav className="wb-links">
        <NavLink to={`/app/campaign/${campaign.id}`} end>
          Dashboard
        </NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/world`}>World</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/sessions`}>Sessions</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/threads`}>Threads</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/search`}>Search</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/members`}>Members</NavLink>
        {canManage && <NavLink to={`/app/campaign/${campaign.id}/settings`}>Settings</NavLink>}
      </nav>
      <Outlet context={{ campaign }} />
      <SearchOverlay campaignId={campaign.id} />
    </div>
  )
}
