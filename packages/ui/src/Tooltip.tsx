import { cloneElement, isValidElement, useId, useState, type ReactElement } from 'react'
import './Tooltip.css'

export interface TooltipProps {
  label: string
  placement?: 'top' | 'right'
  children: ReactElement
}

/**
 * Wraps a single interactive child (a link, a button) with a small label
 * shown on hover *or* keyboard focus — not mouse-only, so it stays usable
 * for a tab-through keyboard user, not just a mouse hover. Triggers off
 * the wrapper (not the child directly) so it works with any trigger
 * element without needing that element to forward a ref; React's
 * onFocus/onBlur bubble via the underlying native focusin/focusout
 * events, so they still fire correctly from a wrapping element.
 */
export function Tooltip({ label, placement = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        'aria-describedby': open ? tooltipId : undefined,
      } as Record<string, unknown>)
    : children

  return (
    <div
      className="wb-tooltip-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span id={tooltipId} role="tooltip" className={`wb-tooltip wb-tooltip--${placement}`}>
          {label}
        </span>
      )}
    </div>
  )
}
