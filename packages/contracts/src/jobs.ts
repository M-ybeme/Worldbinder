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
