import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateRelationshipInput, CreateRelationshipTypeInput } from '@worldbinder/validation'
import * as relationshipsApi from '../api/relationshipsApi'

const relationshipTypesKey = (campaignId: string) =>
  ['campaigns', campaignId, 'relationship-types'] as const
const entityRelationshipsKey = (campaignId: string, entityId: string) =>
  ['campaigns', campaignId, 'entities', entityId, 'relationships'] as const
const entityBacklinksKey = (campaignId: string, entityId: string) =>
  ['campaigns', campaignId, 'entities', entityId, 'backlinks'] as const

export function useRelationshipTypesQuery(campaignId: string) {
  return useQuery({
    queryKey: relationshipTypesKey(campaignId),
    queryFn: () => relationshipsApi.listRelationshipTypes(campaignId),
  })
}

export function useCreateRelationshipTypeMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRelationshipTypeInput) =>
      relationshipsApi.createRelationshipType(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: relationshipTypesKey(campaignId) }),
  })
}

export function useEntityRelationshipsQuery(campaignId: string, entityId: string) {
  return useQuery({
    queryKey: entityRelationshipsKey(campaignId, entityId),
    queryFn: () => relationshipsApi.getEntityRelationships(campaignId, entityId),
  })
}

export function useEntityBacklinksQuery(campaignId: string, entityId: string) {
  return useQuery({
    queryKey: entityBacklinksKey(campaignId, entityId),
    queryFn: () => relationshipsApi.getEntityBacklinks(campaignId, entityId),
  })
}

/** Invalidates both endpoints' relationship views — a new relationship
 * always shows up on both the source's outgoing list and the target's
 * incoming list. */
export function useCreateRelationshipMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRelationshipInput) =>
      relationshipsApi.createRelationship(campaignId, input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: entityRelationshipsKey(campaignId, input.sourceEntityId),
      })
      void queryClient.invalidateQueries({
        queryKey: entityRelationshipsKey(campaignId, input.targetEntityId),
      })
    },
  })
}

export function useDeleteRelationshipMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (relationshipId: string) =>
      relationshipsApi.deleteRelationship(campaignId, relationshipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'entities'] })
    },
  })
}
