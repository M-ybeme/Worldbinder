// Milestone 9 — shared between apps/api (producer: enqueues/schedules) and
// apps/worker (consumer). Unlike the small boilerplate duplicated between
// the two processes elsewhere (logger setup, S3 client construction), a
// queue/job-name mismatch here silently breaks the pipeline (jobs queued
// but never consumed) rather than failing loudly, so these are shared
// constants rather than copy-pasted literals.

export const ATTACHMENT_PROCESSING_QUEUE_NAME = 'attachment-processing'

export const PROCESS_ATTACHMENT_JOB_NAME = 'process-attachment'
export const CLEANUP_ABANDONED_ATTACHMENTS_JOB_NAME = 'cleanup-abandoned-attachments'

export interface ProcessAttachmentJobData {
  attachmentId: string
}

// Milestone 12 — Export and Import. Two queues (not one, unlike attachments'
// single process+cleanup queue) since export and import are separate
// domains with different producers/consumers of their job data.

export const EXPORT_QUEUE_NAME = 'campaign-export'
export const IMPORT_QUEUE_NAME = 'campaign-import'

export const EXPORT_CAMPAIGN_JOB_NAME = 'export-campaign'
export const VALIDATE_IMPORT_JOB_NAME = 'validate-import'
export const RUN_IMPORT_JOB_NAME = 'run-import'

export interface ExportCampaignJobData {
  exportId: string
}

export interface ValidateImportJobData {
  importId: string
}

export interface RunImportJobData {
  importId: string
}
