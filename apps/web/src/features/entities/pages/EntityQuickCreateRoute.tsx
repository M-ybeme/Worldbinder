import { useNavigate } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateEntityDialog } from '../components/QuickCreateEntityDialog'

/**
 * Keeps `/world/new` a valid, deep-linkable URL (bookmarks, back-button,
 * shareable links) without maintaining a second full-form creation UI
 * alongside the quick-create dialog — this route just opens the same
 * dialog WorldListPage's own "New entity" button opens, pre-opened on
 * mount. Cancel/close navigates back to the World list.
 */
export function EntityQuickCreateRoute() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  return (
    <QuickCreateEntityDialog
      campaignId={campaign.id}
      open
      onClose={() => navigate(`/app/campaign/${campaign.id}/world`)}
    />
  )
}
