import type { WorldDate } from './calendar.js'

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
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface CampaignDetail extends CampaignSummary {
  settingsJson: Record<string, unknown> | null
  currentWorldDateJson: WorldDate | null
}
