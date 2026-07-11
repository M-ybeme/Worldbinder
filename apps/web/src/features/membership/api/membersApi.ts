import type {
  CampaignInvitationSummary,
  InvitationPreview,
  MembershipSummary,
} from '@worldbinder/contracts'
import type { InviteMemberInput, UpdateMemberRoleInput } from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listMembers = (campaignId: string): Promise<MembershipSummary[]> =>
  apiGet(`/campaigns/${campaignId}/members`)

export const listInvitations = (campaignId: string): Promise<CampaignInvitationSummary[]> =>
  apiGet(`/campaigns/${campaignId}/invitations`)

export const inviteMember = (
  campaignId: string,
  input: InviteMemberInput,
): Promise<{ message: string }> => apiPost(`/campaigns/${campaignId}/invitations`, input)

export const revokeInvitation = (
  campaignId: string,
  invitationId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/invitations/${invitationId}`)

export const updateMemberRole = (
  campaignId: string,
  memberId: string,
  input: UpdateMemberRoleInput,
): Promise<{ message: string }> => apiPatch(`/campaigns/${campaignId}/members/${memberId}`, input)

export const removeMember = (
  campaignId: string,
  memberId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/members/${memberId}`)

export const previewInvitation = (token: string): Promise<InvitationPreview> =>
  apiGet(`/invitations/${token}`)

export const acceptInvitation = (token: string): Promise<{ campaignId: string }> =>
  apiPost(`/invitations/${token}/accept`)
