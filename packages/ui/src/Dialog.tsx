import {
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { useKeyboardInset } from './useKeyboardInset'
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
  /** `sheet` presents the panel as a bottom sheet (for phones): full width,
   * anchored to the bottom and kept above the on-screen keyboard. */
  placement?: 'center' | 'sheet'
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
  placement = 'center',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const keyboardInset = useKeyboardInset(open && placement === 'sheet')
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Focus-trap contract for role="dialog" aria-modal="true": capture what
  // had focus before opening and restore it on close, so keyboard/screen-
  // reader users land back where they started instead of at the top of body.
  // A layout effect, declared before the initial-focus one, so it captures
  // the opener before focus moves into the dialog.
  useLayoutEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  // Initial focus: the first form field (the point of a quick-create
  // dialog), else the first focusable element. Done synchronously as the
  // dialog opens. It used to wait an animation frame, and on a slow frame a
  // user (or test) could already be typing in the field by then — focus
  // jumped to the Close button mid-word, the rest of the keystrokes went to
  // it, and a typed space "pressed" Close and cleared the form. Focus the
  // user has already placed inside the dialog is never moved.
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel || panel.contains(document.activeElement)) return
    const target =
      panel.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])',
      ) ??
      panel.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
    target?.focus()
  }, [open])

  // Attached in the same commit that shows the dialog. As a passive effect
  // it could run after the dialog was painted (dialogs opened by a
  // non-urgent update, like a failed save), and an Escape pressed in that
  // gap was dropped.
  useLayoutEffect(() => {
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
    <div
      className={['wb-dialog__backdrop', placement === 'sheet' ? 'wb-dialog__backdrop--sheet' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        placement === 'sheet'
          ? ({ '--wb-keyboard-inset': `${keyboardInset}px` } as CSSProperties)
          : undefined
      }
      onMouseDown={onClose}
    >
      {/* This dialog owns its own Tab-trap/Escape handling directly, the
          standard pattern for a real modal — jsx-a11y's interactive-role
          allowlist doesn't include role="dialog" itself. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        className={[
          'wb-dialog__panel',
          placement === 'sheet' ? 'wb-dialog__panel--sheet' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
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
