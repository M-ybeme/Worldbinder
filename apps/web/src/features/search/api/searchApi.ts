import type { SearchResourceType, SearchResponse } from '@worldbinder/contracts'
import { apiGet } from '../../../lib/apiClient'

export interface SearchParams {
  q: string
  types?: SearchResourceType[]
  limit?: number
  offset?: number
}

function toQueryString(params: SearchParams): string {
  const query = new URLSearchParams()
  query.set('q', params.q)
  if (params.types && params.types.length > 0) query.set('types', params.types.join(','))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  return query.toString()
}

export const search = (campaignId: string, params: SearchParams): Promise<SearchResponse> =>
  apiGet(`/campaigns/${campaignId}/search?${toQueryString(params)}`)
