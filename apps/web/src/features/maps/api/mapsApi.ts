import type {
  MapDetail,
  MapLayerSummary,
  MapPinSummary,
  MapSummary,
} from '@worldbinder/contracts'
import type {
  CreateMapInput,
  CreateMapLayerInput,
  CreateMapPinInput,
  RepositionMapPinInput,
  UpdateMapInput,
  UpdateMapLayerInput,
  UpdateMapPinInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listMaps = (campaignId: string): Promise<MapSummary[]> =>
  apiGet(`/campaigns/${campaignId}/maps`)

export const createMap = (campaignId: string, input: CreateMapInput): Promise<MapSummary> =>
  apiPost(`/campaigns/${campaignId}/maps`, input)

export const getMap = (campaignId: string, mapId: string): Promise<MapDetail> =>
  apiGet(`/campaigns/${campaignId}/maps/${mapId}`)

export const updateMap = (
  campaignId: string,
  mapId: string,
  input: UpdateMapInput,
): Promise<MapDetail> => apiPatch(`/campaigns/${campaignId}/maps/${mapId}`, input)

export const deleteMap = (campaignId: string, mapId: string): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/maps/${mapId}`)

export const createMapLayer = (
  campaignId: string,
  mapId: string,
  input: CreateMapLayerInput,
): Promise<MapLayerSummary> => apiPost(`/campaigns/${campaignId}/maps/${mapId}/layers`, input)

export const updateMapLayer = (
  campaignId: string,
  mapId: string,
  layerId: string,
  input: UpdateMapLayerInput,
): Promise<MapLayerSummary> =>
  apiPatch(`/campaigns/${campaignId}/maps/${mapId}/layers/${layerId}`, input)

export const deleteMapLayer = (
  campaignId: string,
  mapId: string,
  layerId: string,
): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/maps/${mapId}/layers/${layerId}`)

export const createMapPin = (
  campaignId: string,
  mapId: string,
  input: CreateMapPinInput,
): Promise<MapPinSummary> => apiPost(`/campaigns/${campaignId}/maps/${mapId}/pins`, input)

export const updateMapPin = (
  campaignId: string,
  mapId: string,
  pinId: string,
  input: UpdateMapPinInput,
): Promise<MapPinSummary> =>
  apiPatch(`/campaigns/${campaignId}/maps/${mapId}/pins/${pinId}`, input)

export const repositionMapPin = (
  campaignId: string,
  mapId: string,
  pinId: string,
  input: RepositionMapPinInput,
): Promise<MapPinSummary> =>
  apiPatch(`/campaigns/${campaignId}/maps/${mapId}/pins/${pinId}/position`, input)

export const deleteMapPin = (
  campaignId: string,
  mapId: string,
  pinId: string,
): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/maps/${mapId}/pins/${pinId}`)
