import type { CampaignTagSummary } from '@worldbinder/contracts'
import type { MergeTagInput, RenameTagInput } from '@worldbinder/validation'
import { apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listCampaignTags = (campaignId: string): Promise<CampaignTagSummary[]> =>
  apiGet(`/campaigns/${campaignId}/tags`)

export const renameTag = (
  campaignId: string,
  tagId: string,
  input: RenameTagInput,
): Promise<{ message: string }> => apiPatch(`/campaigns/${campaignId}/tags/${tagId}`, input)

export const mergeTag = (
  campaignId: string,
  tagId: string,
  input: MergeTagInput,
): Promise<{ message: string }> => apiPost(`/campaigns/${campaignId}/tags/${tagId}/merge`, input)
