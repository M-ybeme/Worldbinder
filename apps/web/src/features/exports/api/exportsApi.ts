import type { CampaignExportSummary } from '@worldbinder/contracts'
import { apiGet, apiPost } from '../../../lib/apiClient'

export const listExports = (campaignId: string): Promise<CampaignExportSummary[]> =>
  apiGet(`/campaigns/${campaignId}/exports`)

export const createExport = (campaignId: string): Promise<CampaignExportSummary> =>
  apiPost(`/campaigns/${campaignId}/exports`)

export const getExport = (campaignId: string, exportId: string): Promise<CampaignExportSummary> =>
  apiGet(`/campaigns/${campaignId}/exports/${exportId}`)
