import type { RevisionResourceType } from '@worldbinder/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as revisionsApi from '../api/revisionsApi'

const revisionsQueryKey = (
  campaignId: string,
  resourceType: RevisionResourceType,
  resourceId: string,
) => ['campaigns', campaignId, 'revisions', resourceType, resourceId] as const

export function useRevisionsQuery(
  campaignId: string,
  resourceType: RevisionResourceType,
  resourceId: string | undefined,
) {
  return useQuery({
    queryKey: revisionsQueryKey(campaignId, resourceType, resourceId ?? ''),
    queryFn: () => revisionsApi.listRevisions(campaignId, resourceType, resourceId as string),
    enabled: !!resourceId,
  })
}

export function useRestoreRevisionMutation(
  campaignId: string,
  resourceType: RevisionResourceType,
  resourceId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (revisionId: string) => revisionsApi.restoreRevision(campaignId, revisionId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: revisionsQueryKey(campaignId, resourceType, resourceId),
      }),
  })
}
