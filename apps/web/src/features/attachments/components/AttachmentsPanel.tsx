import type { AttachmentResourceType, AttachmentSummary } from '@worldbinder/contracts'
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FileDropzone,
  FormMessage,
  IconButton,
  LoadingState,
  TextField,
  Toast,
} from '@worldbinder/ui'
import { ALLOWED_ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from '@worldbinder/validation'
import { FileText, Image as ImageIcon, Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import '../attachments.css'
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
  /** Shown in labels and messages ("Files on Blackwall"). */
  resourceName?: string
  canManage: boolean
  /** Phones: a list with stacked, touch-sized actions instead of a table. */
  compact?: boolean
  /** Inside a container that already titles it (the article's Files side
   * panel): no card or heading of its own. */
  embedded?: boolean
}

const UNDO_MS = 10_000

const STATUS_LABELS: Record<string, string> = {
  pending: 'Uploading…',
  uploaded: 'Processing…',
  processing: 'Processing…',
  rejected: 'Rejected — not a supported file',
  deleted: 'Deleted',
}

const TYPE_LABELS: Record<string, string> = {
  'image/png': 'PNG image',
  'image/jpeg': 'JPEG image',
  'image/webp': 'WebP image',
  'image/gif': 'GIF image',
  'application/pdf': 'PDF',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
}

const ACCEPT = ALLOWED_ATTACHMENT_MIME_TYPES.join(',')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function describe(attachment: AttachmentSummary): string {
  const parts = [
    attachment.detectedMimeType
      ? (TYPE_LABELS[attachment.detectedMimeType] ?? attachment.detectedMimeType)
      : null,
    formatSize(attachment.sizeBytes),
    attachment.width && attachment.height ? `${attachment.width}×${attachment.height}` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** Why a picked file can't be uploaded, checked before sending it (the
 * server's own checks remain the authority). */
function rejectionFor(file: File): string | null {
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return `${file.name} is ${formatSize(file.size)}; files can be up to ${formatSize(ATTACHMENT_MAX_SIZE_BYTES)}.`
  }
  if (file.type && !(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} isn’t a supported type. Images (PNG, JPEG, WebP, GIF), PDFs and text files work.`
  }
  return null
}

type Upload = {
  key: string
  name: string
  state: 'waiting' | 'uploading' | 'failed'
  error?: string
}

type Removed = { attachmentId: string; name: string; caption: string | null; displayOrder: number }

type Notice =
  | { kind: 'removed'; removed: Removed; focusAction: boolean }
  | { kind: 'restoring'; removed: Removed }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

/**
 * Files attached to an entry, session or plot thread.
 *
 * Two different actions, kept visibly apart:
 * - **Remove** unlinks the file from this record only. The stored file stays
 *   in the campaign (and wherever else it's used); Undo re-links it with its
 *   caption for 10 seconds.
 * - **Delete file…** permanently deletes the stored file, after an explicit
 *   confirmation, with no Undo. A file still used anywhere else (another
 *   record, a map's image, the campaign cover) can't be deleted from here —
 *   the API refuses too — so deleting never takes a file away from
 *   something else.
 *
 * Uploads go straight onto the record (several at once, one after another),
 * and an existing upload can be attached instead.
 */
export function AttachmentsPanel({
  campaignId,
  resourceType,
  resourceId,
  resourceName = 'this record',
  canManage,
  compact = false,
  embedded = false,
}: AttachmentsPanelProps) {
  const attachmentsQuery = useAttachmentsForResourceQuery(campaignId, resourceType, resourceId)
  const uploadAndLink = useUploadAndLinkMutation(campaignId, resourceType, resourceId)
  const unlink = useUnlinkAttachmentMutation(campaignId, resourceType, resourceId)
  const deleteAttachment = useDeleteAttachmentMutation(campaignId, resourceType, resourceId)
  const link = useLinkExistingAttachmentMutation(campaignId, resourceType, resourceId)
  const [showPicker, setShowPicker] = useState(false)
  const unlinkedQuery = useUnlinkedAttachmentsQuery(campaignId, showPicker)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<AttachmentSummary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const uploadKey = useRef(0)
  const headingId = useId()

  const attachments = attachmentsQuery.data ?? []

  async function uploadFiles(files: File[]) {
    const rejected = files.map(rejectionFor).filter((reason): reason is string => reason !== null)
    setPickError(rejected.length > 0 ? rejected.join(' ') : null)
    const accepted = files.filter((file) => rejectionFor(file) === null)
    const queued = accepted.map((file) => ({ file, key: `u${(uploadKey.current += 1)}` }))
    setUploads((current) => [
      ...current.filter((upload) => upload.state !== 'failed'),
      ...queued.map(({ file, key }) => ({ key, name: file.name, state: 'waiting' as const })),
    ])
    // One at a time: each upload is presign → storage → processing → link.
    for (const { file, key } of queued) {
      setUploads((current) =>
        current.map((u) => (u.key === key ? { ...u, state: 'uploading' } : u)),
      )
      try {
        await uploadAndLink.mutateAsync(file)
        setUploads((current) => current.filter((u) => u.key !== key))
      } catch (error) {
        setUploads((current) =>
          current.map((u) =>
            u.key === key ? { ...u, state: 'failed', error: (error as Error).message } : u,
          ),
        )
      }
    }
  }

  async function remove(attachment: AttachmentSummary, viaKeyboard: boolean) {
    setRemovingId(attachment.id)
    try {
      await unlink.mutateAsync(attachment.id)
      setNotice({
        kind: 'removed',
        focusAction: viaKeyboard,
        removed: {
          attachmentId: attachment.id,
          name: attachment.originalFilename,
          caption: attachment.caption,
          displayOrder: attachment.displayOrder,
        },
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Couldn’t remove ${attachment.originalFilename}: ${(error as Error).message}`,
      })
    } finally {
      setRemovingId(null)
    }
  }

  async function undo(removed: Removed) {
    setNotice({ kind: 'restoring', removed })
    try {
      await link.mutateAsync({
        attachmentId: removed.attachmentId,
        caption: removed.caption,
        displayOrder: removed.displayOrder,
      })
      setNotice({ kind: 'done', message: `Restored ${removed.name} to ${resourceName}` })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      setNotice({
        kind: 'error',
        message:
          status === 409
            ? `${removed.name} couldn’t be restored: the file was deleted in the meantime.`
            : status === 400 || status === 404
              ? `${removed.name} couldn’t be restored: ${resourceName} no longer exists.`
              : status === 403
                ? `${removed.name} couldn’t be restored: you no longer have permission to manage files.`
                : `${removed.name} couldn’t be restored: ${(error as Error).message}`,
      })
    }
  }

  async function confirmDelete(attachment: AttachmentSummary) {
    setDeleteError(null)
    try {
      await deleteAttachment.mutateAsync(attachment.id)
      setDeleting(null)
      setNotice({ kind: 'done', message: `Deleted ${attachment.originalFilename}` })
    } catch (error) {
      setDeleteError((error as Error).message)
    }
  }

  async function saveCaption(attachment: AttachmentSummary, caption: string) {
    await link.mutateAsync({
      attachmentId: attachment.id,
      caption: caption.trim() || null,
      displayOrder: attachment.displayOrder,
    })
    setEditingCaption(null)
  }

  const usedElsewhere = deleting?.usedElsewhereCount ?? 0

  return (
    <div className="wb-files">
      {canManage && (
        <FileDropzone
          label="Add files"
          multiple
          accept={ACCEPT}
          prompt={
            compact
              ? 'Tap to add a file or photo'
              : 'Drag maps, images or documents here, or click to browse.'
          }
          hint={`Images, PDFs and text files up to ${formatSize(ATTACHMENT_MAX_SIZE_BYTES)}. Uploads attach to ${resourceName} straight away.`}
          onFilesSelected={(files) => void uploadFiles(files)}
          error={pickError ?? undefined}
        />
      )}

      {uploads.length > 0 && (
        <ul className="wb-files__uploads" aria-label="Uploads">
          {uploads.map((upload) => (
            <li key={upload.key} className={`wb-files__upload wb-files__upload--${upload.state}`}>
              <span className="wb-files__name">{upload.name}</span>
              <span role={upload.state === 'failed' ? 'alert' : undefined}>
                {upload.state === 'waiting' && 'Waiting…'}
                {upload.state === 'uploading' && 'Uploading and processing…'}
                {upload.state === 'failed' && `Failed: ${upload.error}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section
        className={embedded ? 'wb-files__embedded' : 'wb-files__card'}
        aria-labelledby={embedded ? undefined : headingId}
      >
        {!embedded && (
          <h2 id={headingId} className="wb-files__title" tabIndex={-1}>
            Files{' '}
            {attachments.length > 0 && <span className="wb-files__count">{attachments.length}</span>}
          </h2>
        )}

        {attachmentsQuery.isLoading && <LoadingState label="Loading files…" />}
        {attachmentsQuery.isError && (
          <ErrorState
            message={attachmentsQuery.error.message}
            onRetry={() => attachmentsQuery.refetch()}
          />
        )}
        {attachmentsQuery.isSuccess && attachments.length === 0 && (
          <EmptyState
            message={
              canManage
                ? 'No files yet. Add maps, handouts or reference images above.'
                : 'No files yet.'
            }
          />
        )}

        {attachments.length > 0 && (
          <ul
            className={`wb-files__list ${compact ? 'wb-files__list--compact' : ''}`}
            aria-label={`Files on ${resourceName}`}
          >
            {attachments.map((attachment) => {
              const ready = attachment.status === 'ready' && attachment.downloadUrl
              const isImage = attachment.detectedMimeType?.startsWith('image/')
              return (
                <li key={attachment.id} className="wb-files__item">
                  <span className="wb-files__thumb" aria-hidden="true">
                    {ready && isImage ? (
                      <img src={attachment.downloadUrl ?? undefined} alt="" />
                    ) : isImage ? (
                      <ImageIcon size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </span>
                  <div className="wb-files__body">
                    {ready ? (
                      <a
                        className="wb-files__name"
                        href={attachment.downloadUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attachment.originalFilename}
                        <span className="wb-visually-hidden"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="wb-files__name">{attachment.originalFilename}</span>
                    )}
                    <span className="wb-files__meta">
                      {attachment.status === 'ready'
                        ? describe(attachment)
                        : STATUS_LABELS[attachment.status]}
                      {' · '}
                      Added {formatDate(attachment.createdAt)}
                      {attachment.uploadedByDisplayName &&
                        ` by ${attachment.uploadedByDisplayName}`}
                    </span>
                    {editingCaption === attachment.id ? (
                      <CaptionEditor
                        name={attachment.originalFilename}
                        initial={attachment.caption ?? ''}
                        pending={link.isPending}
                        error={link.error?.message ?? null}
                        onSave={(caption) => void saveCaption(attachment, caption)}
                        onCancel={() => setEditingCaption(null)}
                      />
                    ) : (
                      <span className="wb-files__caption">
                        {attachment.caption ??
                          (canManage ? <span className="wb-files__muted">No caption</span> : null)}
                        {canManage && (
                          <IconButton
                            label={`Edit caption of ${attachment.originalFilename}`}
                            className="wb-files__caption-edit"
                            onClick={() => setEditingCaption(attachment.id)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </IconButton>
                        )}
                      </span>
                    )}
                    {canManage && (attachment.usedElsewhereCount ?? 0) > 0 && (
                      <span className="wb-files__muted">
                        Also used in {attachment.usedElsewhereCount} other{' '}
                        {attachment.usedElsewhereCount === 1 ? 'place' : 'places'}
                      </span>
                    )}
                  </div>
                  <div className="wb-files__actions">
                    {ready && (
                      <a
                        className="wb-button wb-button--secondary"
                        href={attachment.downloadUrl ?? undefined}
                        download={attachment.originalFilename}
                        aria-label={`Download ${attachment.originalFilename}`}
                      >
                        Download
                      </a>
                    )}
                    {canManage && (
                      <>
                        <Button
                          variant="secondary"
                          disabled={removingId === attachment.id}
                          aria-label={`Remove ${attachment.originalFilename} from ${resourceName}`}
                          onClick={(event) => void remove(attachment, event.detail === 0)}
                        >
                          {removingId === attachment.id ? 'Removing…' : 'Remove'}
                        </Button>
                        <Button
                          variant="secondary"
                          className="wb-files__delete"
                          aria-label={`Delete file ${attachment.originalFilename} permanently…`}
                          onClick={() => {
                            setDeleteError(null)
                            setDeleting(attachment)
                          }}
                        >
                          Delete file…
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canManage && attachments.length > 0 && (
          <p className="wb-files__muted wb-files__legend">
            <strong>Remove</strong> takes the file off {resourceName} and keeps it in the campaign.{' '}
            <strong>Delete file…</strong> deletes it for good, after asking.
          </p>
        )}
      </section>

      {canManage && (
        <div className="wb-files__existing">
          <Button
            variant="secondary"
            aria-expanded={showPicker}
            onClick={() => setShowPicker((value) => !value)}
          >
            {showPicker ? 'Hide uploaded files' : 'Attach a file already uploaded'}
          </Button>
          {showPicker && (
            <ul className="wb-files__picker" aria-label="Uploaded files not attached to anything">
              {unlinkedQuery.isLoading && <li>Loading…</li>}
              {unlinkedQuery.isSuccess && unlinkedQuery.data.length === 0 && (
                <li className="wb-files__muted">No other uploaded files to attach.</li>
              )}
              {(unlinkedQuery.data ?? []).map((attachment) => (
                <li key={attachment.id}>
                  <span className="wb-files__name">{attachment.originalFilename}</span>
                  {attachment.status !== 'ready' && (
                    <span className="wb-files__muted">{STATUS_LABELS[attachment.status]}</span>
                  )}
                  <Button
                    variant="secondary"
                    disabled={attachment.status !== 'ready' || link.isPending}
                    onClick={() => link.mutate({ attachmentId: attachment.id })}
                  >
                    Attach
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={
          usedElsewhere > 0
            ? `${deleting?.originalFilename} is used elsewhere`
            : `Delete ${deleting?.originalFilename}?`
        }
        className="wb-files__dialog"
      >
        {deleting && usedElsewhere > 0 ? (
          <>
            <p>
              This file is also used in {usedElsewhere} other{' '}
              {usedElsewhere === 1 ? 'place' : 'places'} in this campaign (another entry, session or
              thread, a map, or the campaign cover), so it can’t be deleted from here.
            </p>
            <p>Remove it from {resourceName} instead: it stays wherever else it’s used.</p>
            <div className="wb-files__dialog-actions">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const target = deleting
                  setDeleting(null)
                  void remove(target, false)
                }}
              >
                Remove from {resourceName}
              </Button>
            </div>
          </>
        ) : (
          deleting && (
            <>
              <p>
                The stored file is deleted permanently. It disappears from {resourceName} and can’t
                be downloaded again. There’s no Undo.
              </p>
              <p className="wb-files__muted">
                To keep the file but take it off {resourceName}, use Remove.
              </p>
              <FormMessage message={deleteError} tone="error" />
              <div className="wb-files__dialog-actions">
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteAttachment.isPending}
                  onClick={() => void confirmDelete(deleting)}
                >
                  {deleteAttachment.isPending ? 'Deleting…' : 'Delete file'}
                </Button>
              </div>
            </>
          )
        )}
      </Dialog>

      {notice?.kind === 'removed' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          message={
            <>
              Removed <strong>{notice.removed.name}</strong> from {resourceName}
            </>
          }
          announcement={`Removed ${notice.removed.name} from ${resourceName}. Undo is available for 10 seconds.`}
          action={{ label: 'Undo', onClick: () => void undo(notice.removed) }}
          durationMs={UNDO_MS}
          focusAction={notice.focusAction}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'restoring' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          message={`Restoring ${notice.removed.name}…`}
          action={{ label: 'Restoring…', onClick: () => {}, disabled: true }}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'done' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          tone="success"
          message={notice.message}
          durationMs={4000}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'error' && (
        <Toast restoreFocusTo={() => document.getElementById(headingId)} tone="error" message={notice.message} onDismiss={() => setNotice(null)} />
      )}
    </div>
  )
}

function CaptionEditor({
  name,
  initial,
  pending,
  error,
  onSave,
  onCancel,
}: {
  name: string
  initial: string
  pending: boolean
  error: string | null
  onSave: (caption: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Opened by "Edit caption": continue where the user's attention is.
  useEffect(() => inputRef.current?.focus(), [])
  return (
    <form
      className="wb-files__caption-form"
      aria-label={`Caption for ${name}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (!pending) onSave(value)
      }}
    >
      <TextField
        id={id}
        label="Caption"
        value={value}
        ref={inputRef}
        maxLength={500}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onCancel()
          }
        }}
      />
      <div className="wb-files__caption-actions">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save caption'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <FormMessage message={error} tone="error" />
    </form>
  )
}
