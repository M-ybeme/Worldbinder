import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateMapInput,
  CreateMapLayerInput,
  CreateMapPinInput,
  RepositionMapPinInput,
  UpdateMapInput,
  UpdateMapLayerInput,
  UpdateMapPinInput,
} from '@worldbinder/validation'
import * as mapsApi from '../api/mapsApi'

const mapsListKey = (campaignId: string) => ['campaigns', campaignId, 'maps'] as const
const mapQueryKey = (campaignId: string, mapId: string) =>
  [...mapsListKey(campaignId), mapId] as const

export function useMapsQuery(campaignId: string) {
  return useQuery({
    queryKey: mapsListKey(campaignId),
    queryFn: () => mapsApi.listMaps(campaignId),
  })
}

export function useMapQuery(campaignId: string, mapId: string | undefined) {
  return useQuery({
    queryKey: mapQueryKey(campaignId, mapId ?? ''),
    queryFn: () => mapsApi.getMap(campaignId, mapId as string),
    enabled: !!mapId,
    retry: false,
  })
}

export function useCreateMapMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMapInput) => mapsApi.createMap(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapsListKey(campaignId) }),
  })
}

export function useUpdateMapMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateMapInput) => mapsApi.updateMap(campaignId, mapId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) })
      void queryClient.invalidateQueries({ queryKey: mapsListKey(campaignId) })
    },
  })
}

export function useDeleteMapMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mapId: string) => mapsApi.deleteMap(campaignId, mapId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapsListKey(campaignId) }),
  })
}

export function useCreateMapLayerMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMapLayerInput) => mapsApi.createMapLayer(campaignId, mapId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

export function useUpdateMapLayerMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ layerId, input }: { layerId: string; input: UpdateMapLayerInput }) =>
      mapsApi.updateMapLayer(campaignId, mapId, layerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

export function useDeleteMapLayerMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (layerId: string) => mapsApi.deleteMapLayer(campaignId, mapId, layerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

export function useCreateMapPinMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMapPinInput) => mapsApi.createMapPin(campaignId, mapId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

export function useUpdateMapPinMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pinId, input }: { pinId: string; input: UpdateMapPinInput }) =>
      mapsApi.updateMapPin(campaignId, mapId, pinId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

/** Separate from useUpdateMapPinMutation — backs the drag gesture, which
 * fires far more often than a form save and only ever touches coordinates. */
export function useRepositionMapPinMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pinId, input }: { pinId: string; input: RepositionMapPinInput }) =>
      mapsApi.repositionMapPin(campaignId, mapId, pinId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}

export function useDeleteMapPinMutation(campaignId: string, mapId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pinId: string) => mapsApi.deleteMapPin(campaignId, mapId, pinId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mapQueryKey(campaignId, mapId) }),
  })
}
