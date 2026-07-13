import { useQuery } from '@tanstack/react-query'
import * as auditApi from '../api/auditApi'
import type { ListAuditEventsParams } from '../api/auditApi'

export function useAuditEventsQuery(campaignId: string, params: ListAuditEventsParams = {}) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'audit', params] as const,
    queryFn: () => auditApi.listAuditEvents(campaignId, params),
  })
}
