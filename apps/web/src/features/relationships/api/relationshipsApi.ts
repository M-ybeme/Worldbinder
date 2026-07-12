import type {
  Backlink,
  EntityRelationship,
  EntityRelationshipView,
  RelationshipType,
} from '@worldbinder/contracts'
import type {
  CreateRelationshipInput,
  CreateRelationshipTypeInput,
  UpdateRelationshipInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listRelationshipTypes = (campaignId: string): Promise<RelationshipType[]> =>
  apiGet(`/campaigns/${campaignId}/relationship-types`)

export const createRelationshipType = (
  campaignId: string,
  input: CreateRelationshipTypeInput,
): Promise<RelationshipType> => apiPost(`/campaigns/${campaignId}/relationship-types`, input)

export const createRelationship = (
  campaignId: string,
  input: CreateRelationshipInput,
): Promise<EntityRelationship> => apiPost(`/campaigns/${campaignId}/relationships`, input)

export const updateRelationship = (
  campaignId: string,
  relationshipId: string,
  input: UpdateRelationshipInput,
): Promise<EntityRelationship> =>
  apiPatch(`/campaigns/${campaignId}/relationships/${relationshipId}`, input)

export const deleteRelationship = (
  campaignId: string,
  relationshipId: string,
): Promise<{ message: string }> =>
  apiDelete(`/campaigns/${campaignId}/relationships/${relationshipId}`)

export const getEntityRelationships = (
  campaignId: string,
  entityId: string,
): Promise<EntityRelationshipView[]> =>
  apiGet(`/campaigns/${campaignId}/entities/${entityId}/relationships`)

export const getEntityBacklinks = (campaignId: string, entityId: string): Promise<Backlink[]> =>
  apiGet(`/campaigns/${campaignId}/entities/${entityId}/backlinks`)
