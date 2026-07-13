import type { WorldDate } from './calendar.js'
import type { PlotThreadSummary } from './plot-threads.js'
import type { CampaignSessionSummary } from './sessions.js'

export type CampaignStatus = 'draft' | 'active' | 'hiatus' | 'completed' | 'archived'

export type CampaignRole = 'owner' | 'gm' | 'editor' | 'player' | 'viewer'

export interface CampaignSummary {
  id: string
  name: string
  slug: string
  description: string | null
  systemName: string | null
  status: CampaignStatus
  role: CampaignRole
  /** Freshly signed on every request, ~15min expiry — same as attachment
   * download URLs. No visibility gate: any active member can already see
   * the campaign's name/description, so the cover image isn't gated by
   * `attachments.visibility` either. Null if no cover is set or it isn't
   * `ready` yet. */
  coverImageUrl: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface CampaignDetail extends CampaignSummary {
  settingsJson: Record<string, unknown> | null
  currentWorldDateJson: WorldDate | null
}

export interface CampaignActivityItem {
  resourceType: 'entity' | 'session' | 'plot_thread'
  id: string
  title: string
  updatedAt: string
}

/**
 * Backs the campaign Dashboard (roadmap §11.2 "Dashboard aggregation").
 * `recentActivity` deliberately covers both the ui-ux.md sketch's
 * "Recently Edited" and "Recent Activity" widgets — there's no dedicated
 * activity-log table in the data model (only `security_events`, which is
 * auth-only), so one honest "recently changed" feed backs both rather than
 * fabricating a second data source.
 */
export interface CampaignDashboard {
  currentWorldDateJson: WorldDate | null
  status: CampaignStatus
  upcomingSession: CampaignSessionSummary | null
  lastPlayedSession: CampaignSessionSummary | null
  activeThreads: PlotThreadSummary[]
  neglectedThreads: PlotThreadSummary[]
  recentActivity: CampaignActivityItem[]
}
