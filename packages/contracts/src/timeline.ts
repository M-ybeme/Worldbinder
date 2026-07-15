import type { TimelineDate, TimelineDatePrecision } from './calendar.js'
import type { EntitySummary, EntityVisibility, TiptapDoc } from './entities.js'
import type { CampaignSessionSummary } from './sessions.js'

export interface TimelineEventSummary {
  id: string
  campaignId: string
  title: string
  summary: string | null
  startDateJson: TimelineDate | null
  endDateJson: TimelineDate | null
  datePrecision: TimelineDatePrecision | null
  visibility: EntityVisibility
  createdAt: string
  updatedAt: string
}

export interface TimelineEventDetail extends TimelineEventSummary {
  contentJson: TiptapDoc | null
  entities: EntitySummary[]
  sessions: CampaignSessionSummary[]
  tags: string[]
}
