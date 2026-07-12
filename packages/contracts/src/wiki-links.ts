import type { EntitySummary } from './entities.js'

export type WikiLinkSection = 'public' | 'gm'

export interface Backlink {
  sourceEntity: EntitySummary
  section: WikiLinkSection
  displayText: string
  createdAt: string
}
