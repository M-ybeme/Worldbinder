import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateCampaignInput } from '@worldbinder/validation'
import * as campaignsApi from '../api/campaignsApi'

const campaignsQueryKey = ['campaigns'] as const
const campaignQueryKey = (campaignId: string) => ['campaigns', campaignId] as const

export function useCampaignsQuery() {
  return useQuery({ queryKey: campaignsQueryKey, queryFn: campaignsApi.listCampaigns })
}

export function useCampaignQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: campaignQueryKey(campaignId ?? ''),
    queryFn: () => campaignsApi.getCampaign(campaignId as string),
    enabled: !!campaignId,
    retry: false,
  })
}

export function useCampaignDashboardQuery(campaignId: string) {
  return useQuery({
    queryKey: [...campaignQueryKey(campaignId), 'dashboard'],
    queryFn: () => campaignsApi.getCampaignDashboard(campaignId),
  })
}

export function useCreateCampaignMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: campaignsApi.createCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  })
}

function invalidateCampaign(queryClient: ReturnType<typeof useQueryClient>, campaignId: string) {
  queryClient.invalidateQueries({ queryKey: campaignQueryKey(campaignId) })
  queryClient.invalidateQueries({ queryKey: campaignsQueryKey })
}

export function useUpdateCampaignMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateCampaignInput) => campaignsApi.updateCampaign(campaignId, input),
    onSuccess: () => invalidateCampaign(queryClient, campaignId),
  })
}

export function useArchiveCampaignMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => campaignsApi.archiveCampaign(campaignId),
    onSuccess: () => invalidateCampaign(queryClient, campaignId),
  })
}

export function useRestoreCampaignMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => campaignsApi.restoreCampaign(campaignId),
    onSuccess: () => invalidateCampaign(queryClient, campaignId),
  })
}

export function useDeleteCampaignMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => campaignsApi.deleteCampaign(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignsQueryKey }),
  })
}
