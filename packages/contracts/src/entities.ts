export type EntityType =
  | 'character'
  | 'location'
  | 'faction'
  | 'organization'
  | 'item'
  | 'deity'
  | 'creature'
  | 'event'
  | 'quest'
  | 'lore'
  | 'custom'

export type EntityStatus = 'draft' | 'published' | 'archived'
export type EntityVisibility = 'public' | 'gm_only'

export interface TiptapDoc {
  type: 'doc'
  content: unknown[]
  [key: string]: unknown
}

export interface EntitySummary {
  id: string
  campaignId: string
  entityType: EntityType
  name: string
  slug: string
  summary: string | null
  aliases: string[]
  tags: string[]
  status: EntityStatus
  visibility: EntityVisibility
  createdAt: string
  updatedAt: string
}

export interface EntityDetail extends EntitySummary {
  publicContentJson: TiptapDoc | null
  metadataJson: Record<string, unknown> | null
  /** Present only when the caller is authorized to see it — omitted
   * entirely otherwise (roadmap §13.2), never sent as `null`. */
  gmContentJson?: TiptapDoc | null
}
