import { Button } from './Button'
import { Dialog } from './Dialog'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Uses the danger button variant — for destructive actions (delete,
   * revoke, remove). Omit for non-destructive confirmations (e.g. restore). */
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Replaces this codebase's former window.confirm() call sites — same
 * confirm/cancel shape, but styled, keyboard-accessible, and screen-reader
 * friendly via Dialog's focus trap instead of a blocking native prompt. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} className="wb-confirm-dialog">
      {description && <p className="wb-confirm-dialog__description">{description}</p>}
      <div className="wb-confirm-dialog__actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
