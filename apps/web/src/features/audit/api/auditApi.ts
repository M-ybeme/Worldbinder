import type { CampaignAuditEvent } from '@worldbinder/contracts'
import { apiGet } from '../../../lib/apiClient'

export interface ListAuditEventsParams {
  limit?: number
  offset?: number
}

function toQueryString(params: ListAuditEventsParams): string {
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const listAuditEvents = (
  campaignId: string,
  params: ListAuditEventsParams = {},
): Promise<CampaignAuditEvent[]> => apiGet(`/campaigns/${campaignId}/audit${toQueryString(params)}`)
