export type CampaignExportStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface CampaignExportSummary {
  id: string
  campaignId: string
  status: CampaignExportStatus
  sizeBytes: number | null
  errorMessage: string | null
  /** Freshly presigned per request (~15min expiry), only when `status`
   * is `'ready'` — never persisted, same pattern as AttachmentSummary. */
  downloadUrl: string | null
  createdAt: string
  completedAt: string | null
}
