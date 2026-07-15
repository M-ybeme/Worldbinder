import type { AttachmentResourceType } from '@worldbinder/contracts'
import {
  Button,
  EmptyState,
  ErrorState,
  FileDropzone,
  FormMessage,
  LoadingState,
} from '@worldbinder/ui'
import { useState } from 'react'
import {
  useAttachmentsForResourceQuery,
  useDeleteAttachmentMutation,
  useLinkExistingAttachmentMutation,
  useUnlinkAttachmentMutation,
  useUnlinkedAttachmentsQuery,
  useUploadAndLinkMutation,
} from '../hooks/useAttachments'

export interface AttachmentsPanelProps {
  campaignId: string
  resourceType: AttachmentResourceType
  resourceId: string
  canManage: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Uploading…',
  uploaded: 'Processing…',
  processing: 'Processing…',
  ready: 'Ready',
  rejected: 'Rejected (invalid file)',
  deleted: 'Deleted',
}

/** Self-contained panel matching RevisionHistoryPanel's shape — owns its
 * own data fetching, dropped as a JSX sibling on entity/session/thread
 * detail pages. Positioned between "Plot Threads" and "Backlinks" per
 * docs/planning/ui-ux.md's entity-page layout sketch. */
export function AttachmentsPanel({
  campaignId,
  resourceType,
  resourceId,
  canManage,
}: AttachmentsPanelProps) {
  const attachmentsQuery = useAttachmentsForResourceQuery(campaignId, resourceType, resourceId)
  const uploadAndLink = useUploadAndLinkMutation(campaignId, resourceType, resourceId)
  const unlink = useUnlinkAttachmentMutation(campaignId, resourceType, resourceId)
  const deleteAttachment = useDeleteAttachmentMutation(campaignId, resourceType, resourceId)
  const [showPicker, setShowPicker] = useState(false)
  const unlinkedQuery = useUnlinkedAttachmentsQuery(campaignId, showPicker)
  const linkExisting = useLinkExistingAttachmentMutation(campaignId, resourceType, resourceId)

  const attachments = attachmentsQuery.data ?? []

  return (
    <div className="wb-related-content">
      <div>
        <h2>Attachments</h2>

        {attachmentsQuery.isLoading && <LoadingState label="Loading attachments…" />}
        {attachmentsQuery.isError && (
          <ErrorState
            message={attachmentsQuery.error.message}
            onRetry={() => attachmentsQuery.refetch()}
          />
        )}
        {!attachmentsQuery.isLoading && !attachmentsQuery.isError && attachments.length === 0 && (
          <EmptyState message="No attachments yet." />
        )}
        <FormMessage message={uploadAndLink.error?.message ?? null} tone="error" />
        <FormMessage message={unlink.error?.message ?? null} tone="error" />
        <FormMessage message={deleteAttachment.error?.message ?? null} tone="error" />

        <ul className="wb-relationship-list wb-attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              {attachment.status === 'ready' &&
                attachment.detectedMimeType?.startsWith('image/') &&
                attachment.downloadUrl && (
                  <img
                    src={attachment.downloadUrl}
                    alt={attachment.caption ?? attachment.originalFilename}
                  />
                )}
              <div>
                {attachment.status === 'ready' && attachment.downloadUrl ? (
                  <a href={attachment.downloadUrl} target="_blank" rel="noreferrer">
                    {attachment.originalFilename}
                  </a>
                ) : (
                  <strong>{attachment.originalFilename}</strong>
                )}
                {attachment.status !== 'ready' && (
                  <span className="wb-session-list__meta">
                    {' '}
                    · {STATUS_LABELS[attachment.status]}
                  </span>
                )}
                {attachment.caption && (
                  <span className="wb-session-list__meta"> · {attachment.caption}</span>
                )}
              </div>
              {canManage && (
                <div className="wb-entity-header__actions">
                  <Button
                    variant="secondary"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate(attachment.id)}
                  >
                    Remove
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={deleteAttachment.isPending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete "${attachment.originalFilename}"? This cannot be undone.`,
                        )
                      )
                        return
                      deleteAttachment.mutate(attachment.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <>
            <FileDropzone
              label="Upload a new attachment"
              disabled={uploadAndLink.isPending}
              onFilesSelected={(files) => {
                const file = files[0]
                if (file) uploadAndLink.mutate(file)
              }}
            />

            <Button variant="secondary" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? 'Hide existing attachments' : 'Attach an existing upload'}
            </Button>

            {showPicker && (
              <ul className="wb-relationship-list">
                {unlinkedQuery.isLoading && <li>Loading…</li>}
                {!unlinkedQuery.isLoading && (unlinkedQuery.data ?? []).length === 0 && (
                  <li>No other campaign attachments available.</li>
                )}
                {(unlinkedQuery.data ?? []).map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.originalFilename}
                    {attachment.status !== 'ready' && (
                      <span className="wb-session-list__meta">
                        {' '}
                        · {STATUS_LABELS[attachment.status]}
                      </span>
                    )}
                    <div className="wb-entity-header__actions">
                      <Button
                        variant="secondary"
                        disabled={attachment.status !== 'ready' || linkExisting.isPending}
                        onClick={() => linkExisting.mutate(attachment.id)}
                      >
                        Attach
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
