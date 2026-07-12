import type { CampaignSessionSummary } from './sessions.js'
import type { EntitySummary, EntityVisibility, TiptapDoc } from './entities.js'

export type PlotThreadStatus = 'foreshadowed' | 'active' | 'dormant' | 'resolved' | 'abandoned'
export type PlotThreadImportance = 'minor' | 'standard' | 'major' | 'critical'
export type PlotThreadSessionAction = 'introduced' | 'advanced' | 'resolved'

/** The §9.8 player-facing projection of the GM-facing internal status —
 * never the raw enum value for a non-GM viewer. */
export type PlayerFacingThreadStatus = 'open' | 'ongoing' | 'completed'

export interface PlotThreadSessionEntry {
  session: CampaignSessionSummary
  action: PlotThreadSessionAction
}

export interface PlotThreadSummary {
  id: string
  campaignId: string
  title: string
  summary: string | null
  /** Always present, computed from `status` — the safe label for any viewer. */
  playerFacingStatus: PlayerFacingThreadStatus
  /** Present only when the caller can view GM content — omitted entirely
   * otherwise, never sent as `null` (same rule as EntityDetail.gmContentJson). */
  status?: PlotThreadStatus
  importance?: PlotThreadImportance
  visibility: EntityVisibility
  lastReferencedSession: { id: string; sessionNumber: number; title: string } | null
  /** Server-computed "dormancy calculation" (roadmap §11.8) — unresolved
   * and not referenced by a session in the last few played sessions.
   * Always present so the frontend never has to reimplement the rule. */
  neglected: boolean
  createdAt: string
  updatedAt: string
}

export interface PlotThreadDetail extends PlotThreadSummary {
  publicContentJson: TiptapDoc | null
  gmContentJson?: TiptapDoc | null
  entities: EntitySummary[]
  sessions: PlotThreadSessionEntry[]
}
