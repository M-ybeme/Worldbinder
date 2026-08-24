import { useNavigate } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateThreadDialog } from '../components/QuickCreateThreadDialog'

/** `/threads/new` counterpart to EntityQuickCreateRoute. */
export function ThreadQuickCreateRoute() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  return (
    <QuickCreateThreadDialog
      campaignId={campaign.id}
      open
      onClose={() => navigate(`/app/campaign/${campaign.id}/threads`)}
    />
  )
}
