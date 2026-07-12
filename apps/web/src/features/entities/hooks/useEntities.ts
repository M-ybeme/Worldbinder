import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateEntityInput,
  ListEntitiesQuery,
  UpdateEntityInput,
} from '@worldbinder/validation'
import * as entitiesApi from '../api/entitiesApi'

const entitiesListKey = (campaignId: string) => ['campaigns', campaignId, 'entities'] as const
const entitiesQueryKey = (campaignId: string, query: ListEntitiesQuery) =>
  [...entitiesListKey(campaignId), query] as const
const entityQueryKey = (campaignId: string, entityId: string) =>
  [...entitiesListKey(campaignId), entityId] as const

export function useEntitiesQuery(
  campaignId: string,
  query: ListEntitiesQuery = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: entitiesQueryKey(campaignId, query),
    queryFn: () => entitiesApi.listEntities(campaignId, query),
    enabled: options.enabled ?? true,
  })
}

export function useEntityQuery(campaignId: string, entityId: string | undefined) {
  return useQuery({
    queryKey: entityQueryKey(campaignId, entityId ?? ''),
    queryFn: () => entitiesApi.getEntity(campaignId, entityId as string),
    enabled: !!entityId,
    retry: false,
  })
}

export function useCreateEntityMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEntityInput) => entitiesApi.createEntity(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entitiesListKey(campaignId) }),
  })
}

export function useUpdateEntityMutation(campaignId: string, entityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateEntityInput) => entitiesApi.updateEntity(campaignId, entityId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entitiesListKey(campaignId) }),
  })
}

export function useDeleteEntityMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entityId: string) => entitiesApi.deleteEntity(campaignId, entityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entitiesListKey(campaignId) }),
  })
}
