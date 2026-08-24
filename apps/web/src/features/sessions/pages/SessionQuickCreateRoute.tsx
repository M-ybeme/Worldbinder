import { useNavigate } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateSessionDialog } from '../components/QuickCreateSessionDialog'

/** `/sessions/new` counterpart to EntityQuickCreateRoute. */
export function SessionQuickCreateRoute() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  return (
    <QuickCreateSessionDialog
      campaignId={campaign.id}
      open
      onClose={() => navigate(`/app/campaign/${campaign.id}/sessions`)}
    />
  )
}
