import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Toast.css'

export interface ToastProps {
  /** What happened, e.g. "Removed: Blackwall located in Northern March". */
  message: ReactNode
  /** Plain-text version announced to screen readers (defaults to `message`
   * when it's a string). */
  announcement?: string
  tone?: 'neutral' | 'success' | 'error'
  /** One action, such as Undo. */
  action?: { label: string; onClick: () => void; disabled?: boolean }
  onDismiss: () => void
  /** Dismisses itself after this long. The countdown pauses while the
   * pointer is over the toast or focus is inside it, so nobody loses the
   * action mid-reach. Omit to stay until dismissed. */
  durationMs?: number
  /** Move focus to the action as it appears, for keyboard users whose
   * focused control just disappeared (e.g. a removed row's button). */
  focusAction?: boolean
}

/**
 * A single transient notification near the bottom of the screen, above the
 * phone tab bar. Announced through a polite live region (an assertive one
 * for errors) that exists before its text is set, so screen readers reliably
 * read it. Escape or the close button dismisses it.
 */
export function Toast({
  message,
  announcement,
  tone = 'neutral',
  action,
  onDismiss,
  durationMs,
  focusAction = false,
}: ToastProps) {
  const actionRef = useRef<HTMLButtonElement>(null)
  const [paused, setPaused] = useState(false)
  const [spoken, setSpoken] = useState('')
  const remainingRef = useRef(durationMs)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const text = announcement ?? (typeof message === 'string' ? message : '')

  // Filled in after the (empty) live region has mounted.
  useEffect(() => {
    setSpoken(text)
  }, [text])

  useEffect(() => {
    if (focusAction) actionRef.current?.focus()
  }, [focusAction])

  useEffect(() => {
    remainingRef.current = durationMs
  }, [durationMs, message])

  useEffect(() => {
    if (paused || remainingRef.current === undefined) return
    const startedAt = Date.now()
    const handle = window.setTimeout(() => onDismissRef.current(), remainingRef.current)
    return () => {
      window.clearTimeout(handle)
      if (remainingRef.current !== undefined) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt))
      }
    }
  }, [paused, durationMs, message])

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`wb-toast wb-toast--${tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onDismiss()
        }
      }}
    >
      <span className="wb-toast__message" aria-hidden={text ? true : undefined}>
        {message}
      </span>
      <span
        className="wb-visually-hidden"
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
      >
        {spoken}
      </span>
      {action && (
        <button
          ref={actionRef}
          type="button"
          className="wb-toast__action"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      )}
      <button type="button" className="wb-toast__close" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  )
}
