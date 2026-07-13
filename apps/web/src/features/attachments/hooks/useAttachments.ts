import type { AttachmentResourceType, AttachmentSummary } from '@worldbinder/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as attachmentsApi from '../api/attachmentsApi'
import { uploadToStorage } from '../lib/uploadToStorage'

/** Uploads a file without linking it to any resource — used by the
 * campaign cover-image control, which references the attachment directly
 * via campaigns.coverAttachmentId rather than a resource_attachments row.
 * Returns the new attachment's id so the caller can PATCH the campaign. */
export function useUploadUnlinkedAttachmentMutation(campaignId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const { attachmentId, uploadUrl } = await attachmentsApi.presignUpload(campaignId, {
        filename: file.name,
        declaredMimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      })
      await uploadToStorage(uploadUrl, file)
      await attachmentsApi.completeUpload(campaignId, attachmentId)
      return attachmentId
    },
  })
}

const NON_TERMINAL_STATUSES = new Set(['pending', 'uploaded', 'processing'])

const attachmentsForResourceKey = (
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
) => ['campaigns', campaignId, 'attachments', resourceType, resourceId] as const

const unlinkedAttachmentsKey = (campaignId: string) =>
  ['campaigns', campaignId, 'attachments', 'unlinked'] as const

export function useAttachmentsForResourceQuery(
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string | undefined,
) {
  return useQuery({
    queryKey: attachmentsForResourceKey(campaignId, resourceType, resourceId ?? ''),
    queryFn: () => attachmentsApi.listForResource(campaignId, resourceType, resourceId as string),
    enabled: !!resourceId,
    // First polling precedent in this codebase — keeps the panel live while
    // the worker processes an upload, without the user needing to refresh.
    refetchInterval: (query) => {
      const attachments = query.state.data as AttachmentSummary[] | undefined
      const hasPending = attachments?.some((a) => NON_TERMINAL_STATUSES.has(a.status))
      return hasPending ? 2000 : false
    },
  })
}

export function useUnlinkedAttachmentsQuery(
  campaignId: string,
  enabled: boolean,
  pollWhilePending = false,
) {
  return useQuery({
    queryKey: unlinkedAttachmentsKey(campaignId),
    queryFn: () => attachmentsApi.listUnlinked(campaignId),
    enabled,
    refetchInterval: pollWhilePending
      ? (query) => {
          const attachments = query.state.data as AttachmentSummary[] | undefined
          const hasPending = attachments?.some((a) => NON_TERMINAL_STATUSES.has(a.status))
          return hasPending ? 2000 : false
        }
      : undefined,
  })
}

/** Orchestrates the full presign -> direct storage PUT -> complete -> link
 * pipeline for uploading a new file straight onto a resource — the
 * panel's primary "attach a file" action. */
export function useUploadAndLinkMutation(
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const { attachmentId, uploadUrl } = await attachmentsApi.presignUpload(campaignId, {
        filename: file.name,
        declaredMimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      })
      await uploadToStorage(uploadUrl, file)
      await attachmentsApi.completeUpload(campaignId, attachmentId)
      // link() requires status 'ready', but the worker processes
      // asynchronously — complete() only fires the job, it doesn't wait for
      // it — so this must poll rather than link immediately.
      await pollUntilProcessed(campaignId, attachmentId)
      await attachmentsApi.linkAttachment(campaignId, attachmentId, { resourceType, resourceId })
      return attachmentId
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attachmentsForResourceKey(campaignId, resourceType, resourceId),
      }),
  })
}

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 20

async function pollUntilProcessed(campaignId: string, attachmentId: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const attachment = await attachmentsApi.getAttachment(campaignId, attachmentId)
    if (attachment.status === 'ready') return
    if (attachment.status === 'rejected') {
      throw new Error('That file was rejected — it may not be a supported type.')
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error('Processing is taking longer than expected — try again shortly.')
}

export function useLinkExistingAttachmentMutation(
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.linkAttachment(campaignId, attachmentId, { resourceType, resourceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attachmentsForResourceKey(campaignId, resourceType, resourceId),
      })
      void queryClient.invalidateQueries({ queryKey: unlinkedAttachmentsKey(campaignId) })
    },
  })
}

export function useUnlinkAttachmentMutation(
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.unlinkAttachment(campaignId, attachmentId, resourceType, resourceId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attachmentsForResourceKey(campaignId, resourceType, resourceId),
      }),
  })
}

export function useDeleteAttachmentMutation(
  campaignId: string,
  resourceType: AttachmentResourceType,
  resourceId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.deleteAttachment(campaignId, attachmentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attachmentsForResourceKey(campaignId, resourceType, resourceId),
      }),
  })
}
