import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateMemberRoleInput } from '@worldbinder/validation'
import type { InviteMemberInput } from '@worldbinder/validation'
import * as membersApi from '../api/membersApi'

const membersQueryKey = (campaignId: string) => ['campaigns', campaignId, 'members'] as const
const invitationsQueryKey = (campaignId: string) =>
  ['campaigns', campaignId, 'invitations'] as const

export function useMembersQuery(campaignId: string) {
  return useQuery({
    queryKey: membersQueryKey(campaignId),
    queryFn: () => membersApi.listMembers(campaignId),
  })
}

export function useInvitationsQuery(campaignId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationsQueryKey(campaignId),
    queryFn: () => membersApi.listInvitations(campaignId),
    enabled,
  })
}

export function useInviteMemberMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InviteMemberInput) => membersApi.inviteMember(campaignId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQueryKey(campaignId) }),
  })
}

export function useRevokeInvitationMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) => membersApi.revokeInvitation(campaignId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsQueryKey(campaignId) }),
  })
}

export function useUpdateMemberRoleMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: UpdateMemberRoleInput }) =>
      membersApi.updateMemberRole(campaignId, memberId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersQueryKey(campaignId) }),
  })
}

export function useRemoveMemberMutation(campaignId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) => membersApi.removeMember(campaignId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersQueryKey(campaignId) }),
  })
}
