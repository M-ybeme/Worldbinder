import { Link, NavLink, Outlet } from 'react-router-dom'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

export function CampaignLayout() {
  const { campaign } = useCampaignOutletContext()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

  return (
    <div>
      <header className="wb-campaign-header">
        <Link to="/app/campaigns">All campaigns</Link>
        <CampaignSwitcher currentCampaignId={campaign.id} />
        <h1>{campaign.name}</h1>
      </header>
      <nav className="wb-links">
        <NavLink to={`/app/campaign/${campaign.id}`} end>
          Overview
        </NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/world`}>World</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/sessions`}>Sessions</NavLink>
        <NavLink to={`/app/campaign/${campaign.id}/members`}>Members</NavLink>
        {canManage && <NavLink to={`/app/campaign/${campaign.id}/settings`}>Settings</NavLink>}
      </nav>
      <Outlet context={{ campaign }} />
    </div>
  )
}
