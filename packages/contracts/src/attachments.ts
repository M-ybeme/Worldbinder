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
  /** How many *other* places in the campaign use this file (other entries,
   * sessions or threads, a map's image, a campaign's cover). Only on a
   * resource's list, and only for members who can manage attachments — a
   * count, never which places. A file used elsewhere can't be deleted. */
  usedElsewhereCount?: number
}

export interface PresignedUploadResponse {
  attachmentId: string
  uploadUrl: string
  expiresAt: string
}
