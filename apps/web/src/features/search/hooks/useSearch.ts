import { useQuery } from '@tanstack/react-query'
import * as searchApi from '../api/searchApi'
import type { SearchParams } from '../api/searchApi'

const searchQueryKey = (campaignId: string, params: SearchParams) =>
  ['campaigns', campaignId, 'search', params] as const

export function useSearchQuery(
  campaignId: string,
  params: SearchParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: searchQueryKey(campaignId, params),
    queryFn: () => searchApi.search(campaignId, params),
    enabled: options.enabled ?? true,
  })
}
