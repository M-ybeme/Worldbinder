import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import './Dialog.css'

export interface DialogProps {
  open: boolean
  onClose: () => void
  /** Rendered as a visible heading and wired to aria-labelledby. Omit and
   * pass `label` instead for dialogs (like search) that don't want a
   * visible heading row. */
  title?: string
  /** aria-label, used only when `title` is omitted. */
  label?: string
  children: ReactNode
  /** Extra class(es) on the panel — for a dialog variant's own max-width/
   * layout tweaks. Keep skin properties (background/border/shadow/radius)
   * off this override where possible; those live on .wb-dialog__panel so
   * every dialog shares one visual language. */
  className?: string
  hideCloseButton?: boolean
  /** Content hugs the panel edges instead of getting the default body
   * padding — for dialogs (like search) that manage their own internal
   * spacing/scrolling. */
  flush?: boolean
}

/**
 * Generic portal-rendered modal: focus trap, Escape-to-close, click-outside
 * backdrop dismiss, and focus restore on close. Extracted from
 * SearchOverlay's original hand-rolled implementation — see that
 * component, which now renders through this primitive instead of owning
 * its own copy of this logic.
 */
export function Dialog({
  open,
  onClose,
  title,
  label,
  children,
  className,
  hideCloseButton,
  flush,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Focus-trap contract for role="dialog" aria-modal="true": capture what
  // had focus before opening and restore it on close, so keyboard/screen-
  // reader users land back where they started instead of at the top of body.
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus()
    })
    return () => cancelAnimationFrame(handle)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleDocumentKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [open, onClose])

  // Minimal focus trap: keeps Tab from leaving the dialog while it's open.
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return createPortal(
    // Click-outside-to-dismiss is a pointer-only convenience; the keyboard
    // equivalent (Escape) is handled above. This backdrop must stay a plain
    // div, not a button — giving it a role/tabindex would make it a
    // spurious tab stop inside the dialog's own focus trap.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="wb-dialog__backdrop" onMouseDown={onClose}>
      {/* This dialog owns its own Tab-trap/Escape handling directly, the
          standard pattern for a real modal — jsx-a11y's interactive-role
          allowlist doesn't include role="dialog" itself. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        className={['wb-dialog__panel', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : label}
        aria-labelledby={title ? titleId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        {(title || !hideCloseButton) && (
          <div className="wb-dialog__header">
            {title && (
              <h2 id={titleId} className="wb-dialog__title">
                {title}
              </h2>
            )}
            {!hideCloseButton && (
              <IconButton label="Close" onClick={onClose} className="wb-dialog__close">
                <X size={18} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )}
        <div
          className={['wb-dialog__body', flush ? 'wb-dialog__body--flush' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
