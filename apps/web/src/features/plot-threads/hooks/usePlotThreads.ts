import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePlotThreadInput, UpdatePlotThreadInput } from '@worldbinder/validation'
import * as plotThreadsApi from '../api/plotThreadsApi'

const threadsListKey = (campaignId: string) => ['campaigns', campaignId, 'plot-threads'] as const
const threadQueryKey = (campaignId: string, threadId: string) =>
  [...threadsListKey(campaignId), threadId] as const

export function usePlotThreadsQuery(campaignId: string) {
  return useQuery({
    queryKey: threadsListKey(campaignId),
    queryFn: () => plotThreadsApi.listPlotThreads(campaignId),
  })
}

export function usePlotThreadQuery(campaignId: string, threadId: string | undefined) {
  return useQuery({
    queryKey: threadQueryKey(campaignId, threadId ?? ''),
    queryFn: () => plotThreadsApi.getPlotThread(campaignId, threadId as string),
    enabled: !!threadId,
    retry: false,
  })
}

export function useCreatePlotThreadMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePlotThreadInput) =>
      plotThreadsApi.createPlotThread(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsListKey(campaignId) }),
  })
}

export function useUpdatePlotThreadMutation(campaignId: string, threadId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePlotThreadInput) =>
      plotThreadsApi.updatePlotThread(campaignId, threadId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsListKey(campaignId) }),
  })
}

export function useDeletePlotThreadMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) => plotThreadsApi.deletePlotThread(campaignId, threadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsListKey(campaignId) }),
  })
}
