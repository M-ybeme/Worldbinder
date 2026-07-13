import type {
  AttachmentResourceType,
  AttachmentSummary,
  PresignedUploadResponse,
} from '@worldbinder/contracts'
import { apiDelete, apiGet, apiPost } from '../../../lib/apiClient'

export interface PresignUploadInput {
  filename: string
  declaredMimeType: string
  sizeBytes: number
}

export const presignUpload = (
  campaignId: string,
  input: PresignUploadInput,
): Promise<PresignedUploadResponse> =>
  apiPost(`/campaigns/${campaignId}/attachments/presign`, input)

export const completeUpload = (
  campaignId: string,
  attachmentId: string,
): Promise<AttachmentSummary> =>
  apiPost(`/campaigns/${campaignId}/attachments/${attachmentId}/complete`)

export const getAttachment = (
  campaignId: string,
  attachmentId: string,
): Promise<AttachmentSummary> => apiGet(`/campaigns/${campaignId}/attachments/${attachmentId}`)

export const listForResource = (
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
): Promise<AttachmentSummary[]> =>
  apiGet(`/campaigns/${campaignId}/attachments/${resourceType}/${resourceId}`)

export const listUnlinked = (campaignId: string): Promise<AttachmentSummary[]> =>
  apiGet(`/campaigns/${campaignId}/attachments`)

export interface LinkAttachmentInput {
  resourceType: AttachmentResourceType
  resourceId: string
  caption?: string | null
  displayOrder?: number
}

export const linkAttachment = (
  campaignId: string,
  attachmentId: string,
  input: LinkAttachmentInput,
): Promise<{ message: string }> =>
  apiPost(`/campaigns/${campaignId}/attachments/${attachmentId}/link`, input)

export const unlinkAttachment = (
  campaignId: string,
  attachmentId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
): Promise<{ message: string }> =>
  apiDelete(
    `/campaigns/${campaignId}/attachments/${attachmentId}/link/${resourceType}/${resourceId}`,
  )

export const deleteAttachment = (
  campaignId: string,
  attachmentId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/attachments/${attachmentId}`)
