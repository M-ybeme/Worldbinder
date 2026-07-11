import { useNavigate } from 'react-router-dom'
import { useCampaignsQuery } from '../hooks/useCampaigns'

interface CampaignSwitcherProps {
  currentCampaignId: string
}

export function CampaignSwitcher({ currentCampaignId }: CampaignSwitcherProps) {
  const campaignsQuery = useCampaignsQuery()
  const navigate = useNavigate()
  const campaigns = campaignsQuery.data ?? []

  return (
    <select
      className="wb-campaign-switcher"
      aria-label="Switch campaign"
      value={currentCampaignId}
      onChange={(event) => navigate(`/app/campaign/${event.target.value}`)}
    >
      {campaigns.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.name}
        </option>
      ))}
    </select>
  )
}
