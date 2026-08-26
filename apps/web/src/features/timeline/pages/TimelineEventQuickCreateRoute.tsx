import { DEFAULT_CALENDAR_CONFIG } from '@worldbinder/validation'
import { useNavigate } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateTimelineEventDialog } from '../components/QuickCreateTimelineEventDialog'

/**
 * Keeps `/world/timeline/new` a valid, deep-linkable URL without maintaining
 * a second full-form creation UI alongside the quick-create dialog — same
 * pattern as EntityQuickCreateRoute/SessionQuickCreateRoute/
 * ThreadQuickCreateRoute. Cancel/close navigates back to the Timeline list.
 */
export function TimelineEventQuickCreateRoute() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  return (
    <QuickCreateTimelineEventDialog
      campaignId={campaign.id}
      calendarConfig={campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG}
      open
      onClose={() => navigate(`/app/campaign/${campaign.id}/world/timeline`)}
    />
  )
}
