import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EntityDetail } from '@worldbinder/contracts'
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

/** Resolves entity IDs held in another entity's metadata (e.g. a
 * character's current location) through the same per-entity endpoint and
 * cache as the detail page — so the API's visibility rules decide what a
 * member may see. An ID the member can't see (or that no longer exists)
 * resolves to `null`, never to a name. */
export function useReferencedEntities(
  campaignId: string,
  entityIds: string[],
): { entities: Map<string, EntityDetail | null>; isLoading: boolean } {
  const results = useQueries({
    queries: entityIds.map((id) => ({
      queryKey: entityQueryKey(campaignId, id),
      queryFn: () => entitiesApi.getEntity(campaignId, id),
      retry: false,
    })),
  })
  const entities = new Map<string, EntityDetail | null>()
  entityIds.forEach((id, index) => {
    const result = results[index]
    if (result?.isSuccess) entities.set(id, result.data)
    else if (result?.isError) entities.set(id, null)
  })
  return { entities, isLoading: results.some((result) => result.isLoading) }
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

export function useEntitySessionsQuery(campaignId: string, entityId: string | undefined) {
  return useQuery({
    queryKey: [...entityQueryKey(campaignId, entityId ?? ''), 'sessions'],
    queryFn: () => entitiesApi.getEntitySessions(campaignId, entityId as string),
    enabled: !!entityId,
  })
}

export function useEntityPlotThreadsQuery(campaignId: string, entityId: string | undefined) {
  return useQuery({
    queryKey: [...entityQueryKey(campaignId, entityId ?? ''), 'plot-threads'],
    queryFn: () => entitiesApi.getEntityPlotThreads(campaignId, entityId as string),
    enabled: !!entityId,
  })
}

export function useToggleFavoriteMutation(campaignId: string, entityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (nextIsFavorite: boolean) =>
      nextIsFavorite
        ? entitiesApi.favoriteEntity(campaignId, entityId)
        : entitiesApi.unfavoriteEntity(campaignId, entityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entityQueryKey(campaignId, entityId) })
      void queryClient.invalidateQueries({ queryKey: entitiesListKey(campaignId) })
    },
  })
}
