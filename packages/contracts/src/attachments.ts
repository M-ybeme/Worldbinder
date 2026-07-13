export type AttachmentResourceType = 'entity' | 'session' | 'plot_thread'

export type AttachmentStatus =
  'pending' | 'uploaded' | 'processing' | 'ready' | 'rejected' | 'deleted'

export interface AttachmentSummary {
  id: string
  originalFilename: string
  detectedMimeType: string | null
  sizeBytes: number
  width: number | null
  height: number | null
  status: AttachmentStatus
  uploadedByUserId: string | null
  uploadedByDisplayName: string | null
  createdAt: string
  caption: string | null
  displayOrder: number
  /** Freshly generated on every request (~15min expiry) — never persisted,
   * never a separate "renew" round trip; refetch the list instead. Null
   * while status isn't `ready` (nothing to download yet). */
  downloadUrl: string | null
}

export interface PresignedUploadResponse {
  attachmentId: string
  uploadUrl: string
  expiresAt: string
}
