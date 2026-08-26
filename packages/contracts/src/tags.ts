export interface CampaignTagSummary {
  id: string
  name: string
  /** Total links across all 4 taggable resource types (entities, timeline
   * events, sessions, plot threads) in this campaign. */
  usageCount: number
}
