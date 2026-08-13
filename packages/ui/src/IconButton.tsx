import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.css'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Not visible — the button renders icon-only, so this becomes its
   * accessible name via aria-label. */
  label: string
  children: ReactNode
}

export function IconButton({
  label,
  children,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={['wb-icon-button', className].filter(Boolean).join(' ')}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}
