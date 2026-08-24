import type {
  CampaignSessionSummary,
  EntityDetail,
  EntitySummary,
  PlotThreadSummary,
} from '@worldbinder/contracts'
import type {
  CreateEntityInput,
  ListEntitiesQuery,
  UpdateEntityInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

function toQueryString(query: ListEntitiesQuery): string {
  const params = new URLSearchParams()
  if (query.entityType) params.set('entityType', query.entityType)
  if (query.tag) params.set('tag', query.tag)
  if (query.search) params.set('search', query.search)
  if (query.visibility) params.set('visibility', query.visibility)
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.favorite) params.set('favorite', query.favorite)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const listEntities = (
  campaignId: string,
  query: ListEntitiesQuery = {},
): Promise<EntitySummary[]> => apiGet(`/campaigns/${campaignId}/entities${toQueryString(query)}`)

export const createEntity = (campaignId: string, input: CreateEntityInput): Promise<EntityDetail> =>
  apiPost(`/campaigns/${campaignId}/entities`, input)

export const getEntity = (campaignId: string, entityId: string): Promise<EntityDetail> =>
  apiGet(`/campaigns/${campaignId}/entities/${entityId}`)

export const updateEntity = (
  campaignId: string,
  entityId: string,
  input: UpdateEntityInput,
): Promise<EntityDetail> => apiPatch(`/campaigns/${campaignId}/entities/${entityId}`, input)

export const deleteEntity = (campaignId: string, entityId: string): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/entities/${entityId}`)

export const getEntitySessions = (
  campaignId: string,
  entityId: string,
): Promise<CampaignSessionSummary[]> =>
  apiGet(`/campaigns/${campaignId}/entities/${entityId}/sessions`)

export const getEntityPlotThreads = (
  campaignId: string,
  entityId: string,
): Promise<PlotThreadSummary[]> =>
  apiGet(`/campaigns/${campaignId}/entities/${entityId}/plot-threads`)

export const favoriteEntity = (
  campaignId: string,
  entityId: string,
): Promise<{ message: string }> => apiPost(`/campaigns/${campaignId}/entities/${entityId}/favorite`)

export const unfavoriteEntity = (
  campaignId: string,
  entityId: string,
): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/entities/${entityId}/favorite`)
