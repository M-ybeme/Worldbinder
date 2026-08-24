import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { FormMessage } from './FormMessage'
import './QuickCreateDialog.css'

export interface QuickCreateDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  onSubmit: () => void
  submitLabel?: string
  submitDisabled?: boolean
  pending?: boolean
  error?: string | null
}

/**
 * Generic "type a name, create, fill in the rest later" modal — the
 * quick-create flow docs/planning/ui-ux.md's "Creating Information"
 * section calls for, distinct from the full *FormPage edit forms (which
 * stay the place where "progressively fill in details" actually happens).
 * Content-agnostic like Dialog itself, following ConfirmDialog's own
 * compositional template (Dialog + Buttons + pending state) but with a
 * real form-field slot instead of description text.
 */
export function QuickCreateDialog({
  open,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Create',
  submitDisabled,
  pending,
  error,
}: QuickCreateDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} className="wb-quick-create-dialog">
      <form
        className="wb-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
        <FormMessage message={error ?? null} tone="error" />
        <div className="wb-quick-create-dialog__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitDisabled || pending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
