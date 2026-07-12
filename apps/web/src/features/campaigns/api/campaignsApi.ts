import type { CampaignDashboard, CampaignDetail, CampaignSummary } from '@worldbinder/contracts'
import type { CreateCampaignInput, UpdateCampaignInput } from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listCampaigns = (): Promise<CampaignSummary[]> => apiGet('/campaigns')

export const createCampaign = (input: CreateCampaignInput): Promise<CampaignDetail> =>
  apiPost('/campaigns', input)

export const getCampaign = (campaignId: string): Promise<CampaignDetail> =>
  apiGet(`/campaigns/${campaignId}`)

export const getCampaignDashboard = (campaignId: string): Promise<CampaignDashboard> =>
  apiGet(`/campaigns/${campaignId}/dashboard`)

export const updateCampaign = (
  campaignId: string,
  input: UpdateCampaignInput,
): Promise<CampaignDetail> => apiPatch(`/campaigns/${campaignId}`, input)

export const archiveCampaign = (campaignId: string): Promise<{ message: string }> =>
  apiPost(`/campaigns/${campaignId}/archive`)

export const restoreCampaign = (campaignId: string): Promise<{ message: string }> =>
  apiPost(`/campaigns/${campaignId}/restore`)

export const deleteCampaign = (campaignId: string): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}`)
