import type { CampaignDetail } from '@worldbinder/contracts'
import { useOutletContext } from 'react-router-dom'

export interface CampaignOutletContext {
  campaign: CampaignDetail
}

export function useCampaignOutletContext(): CampaignOutletContext {
  return useOutletContext<CampaignOutletContext>()
}
