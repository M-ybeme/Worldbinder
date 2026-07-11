import type { CampaignRole } from './campaigns.js'

export type CampaignMemberStatus = 'active' | 'removed'

export interface MembershipSummary {
  id: string
  userId: string
  email: string
  displayName: string
  role: CampaignRole
  editorSecretAccess: boolean
  status: CampaignMemberStatus
  createdAt: string
}

export interface CampaignInvitationSummary {
  id: string
  email: string
  role: CampaignRole
  invitedByUserId: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface InvitationPreview {
  campaignName: string
  role: CampaignRole
  expiresAt: string
}
