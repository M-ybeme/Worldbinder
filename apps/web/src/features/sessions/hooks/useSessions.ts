import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CompleteSessionInput,
  CreateSessionInput,
  RevealEntityInput,
  UpdateSessionInput,
} from '@worldbinder/validation'
import * as sessionsApi from '../api/sessionsApi'

const sessionsListKey = (campaignId: string) => ['campaigns', campaignId, 'sessions'] as const
const sessionQueryKey = (campaignId: string, sessionId: string) =>
  [...sessionsListKey(campaignId), sessionId] as const

export function useSessionsQuery(campaignId: string) {
  return useQuery({
    queryKey: sessionsListKey(campaignId),
    queryFn: () => sessionsApi.listSessions(campaignId),
  })
}

export function useSessionQuery(campaignId: string, sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionQueryKey(campaignId, sessionId ?? ''),
    queryFn: () => sessionsApi.getSession(campaignId, sessionId as string),
    enabled: !!sessionId,
    retry: false,
  })
}

export function useCreateSessionMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSessionInput) => sessionsApi.createSession(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsListKey(campaignId) }),
  })
}

export function useUpdateSessionMutation(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSessionInput) =>
      sessionsApi.updateSession(campaignId, sessionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsListKey(campaignId) }),
  })
}

export function useDeleteSessionMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => sessionsApi.deleteSession(campaignId, sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsListKey(campaignId) }),
  })
}

export function useCompleteSessionMutation(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CompleteSessionInput) =>
      sessionsApi.completeSession(campaignId, sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsListKey(campaignId) })
      // Completion can advance the campaign's current world date.
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
    },
  })
}

export function useRevealEntityMutation(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RevealEntityInput) =>
      sessionsApi.revealEntity(campaignId, sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey(campaignId, sessionId) })
      // A revealed entity's own page, relationships, and backlinks change too.
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'entities'] })
    },
  })
}
