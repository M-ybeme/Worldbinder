import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateTimelineEventInput,
  ListTimelineEventsQuery,
  UpdateTimelineEventInput,
} from '@worldbinder/validation'
import * as timelineApi from '../api/timelineApi'

const timelineListKey = (campaignId: string, query: ListTimelineEventsQuery = {}) =>
  ['campaigns', campaignId, 'timeline', query] as const
const timelineEventKey = (campaignId: string, eventId: string) =>
  ['campaigns', campaignId, 'timeline', 'event', eventId] as const

export function useTimelineEventsQuery(campaignId: string, query: ListTimelineEventsQuery = {}) {
  return useQuery({
    queryKey: timelineListKey(campaignId, query),
    queryFn: () => timelineApi.listTimelineEvents(campaignId, query),
  })
}

export function useTimelineEventQuery(campaignId: string, eventId: string | undefined) {
  return useQuery({
    queryKey: timelineEventKey(campaignId, eventId ?? ''),
    queryFn: () => timelineApi.getTimelineEvent(campaignId, eventId as string),
    enabled: !!eventId,
    retry: false,
  })
}

export function useCreateTimelineEventMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTimelineEventInput) =>
      timelineApi.createTimelineEvent(campaignId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'timeline'] }),
  })
}

export function useUpdateTimelineEventMutation(campaignId: string, eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTimelineEventInput) =>
      timelineApi.updateTimelineEvent(campaignId, eventId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'timeline'] }),
  })
}

export function useDeleteTimelineEventMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) => timelineApi.deleteTimelineEvent(campaignId, eventId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'timeline'] }),
  })
}
