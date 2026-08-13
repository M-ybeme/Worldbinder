import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import './Checkbox.css'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...props },
  ref,
) {
  return (
    <label className={['wb-checkbox', className].filter(Boolean).join(' ')}>
      <input ref={ref} type="checkbox" className="wb-checkbox__input" {...props} />
      <span className="wb-checkbox__label">{label}</span>
    </label>
  )
})
