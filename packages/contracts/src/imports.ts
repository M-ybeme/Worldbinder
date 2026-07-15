export type CampaignImportStatus =
  'pending' | 'validating' | 'dry_run_ready' | 'importing' | 'completed' | 'failed'

/** Per-resource-type counts plus any non-fatal warnings — the same shape
 * backs both the pre-confirm dry-run report and the post-import report. */
export interface ImportReport {
  counts: Record<string, number>
  warnings: string[]
}

export interface CampaignImportSummary {
  id: string
  status: CampaignImportStatus
  dryRunReport: ImportReport | null
  importReport: ImportReport | null
  resultCampaignId: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface PresignedImportUploadResponse {
  importId: string
  uploadUrl: string
  expiresAt: string
}
