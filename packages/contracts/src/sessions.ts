import type { WorldDate } from './calendar.js'
import type { EntitySummary, EntityVisibility, TiptapDoc } from './entities.js'

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface SessionParticipant {
  campaignMemberId: string
  userId: string
  displayName: string
}

// Prefixed "Campaign" to avoid colliding with auth.ts's SessionSummary
// (a login/device session, unrelated to campaign game sessions).
export interface CampaignSessionSummary {
  id: string
  campaignId: string
  sessionNumber: number
  title: string
  status: SessionStatus
  scheduledAt: string | null
  playedAt: string | null
  worldStartDateJson: WorldDate | null
  worldEndDateJson: WorldDate | null
  visibility: EntityVisibility
  createdAt: string
  updatedAt: string
}

export interface CampaignSessionDetail extends CampaignSessionSummary {
  recapContentJson: TiptapDoc | null
  /** Present only when the caller can view GM content — omitted entirely
   * otherwise, never sent as `null` (same rule as EntityDetail.gmContentJson). */
  plannedContentJson?: TiptapDoc | null
  gmContentJson?: TiptapDoc | null
  participants: SessionParticipant[]
  featuredEntities: EntitySummary[]
  locations: EntitySummary[]
  reveals: EntitySummary[]
}
