import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MergeTagInput, RenameTagInput } from '@worldbinder/validation'
import * as tagsApi from '../api/tagsApi'

const campaignTagsKey = (campaignId: string) => ['campaigns', campaignId, 'tags'] as const

export function useCampaignTagsQuery(campaignId: string) {
  return useQuery({
    queryKey: campaignTagsKey(campaignId),
    queryFn: () => tagsApi.listCampaignTags(campaignId),
  })
}

export function useRenameTagMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, input }: { tagId: string; input: RenameTagInput }) =>
      tagsApi.renameTag(campaignId, tagId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignTagsKey(campaignId) }),
  })
}

export function useMergeTagMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, input }: { tagId: string; input: MergeTagInput }) =>
      tagsApi.mergeTag(campaignId, tagId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignTagsKey(campaignId) }),
  })
}
