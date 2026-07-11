import type { EntityDetail, EntitySummary } from '@worldbinder/contracts'
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
