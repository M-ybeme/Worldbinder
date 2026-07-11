import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, id, name, className, ...props },
  ref,
) {
  const fieldId = id ?? name
  const select = (
    <select
      ref={ref}
      id={fieldId}
      name={name}
      className={['wb-field__input', className].filter(Boolean).join(' ')}
      aria-invalid={!!error}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )

  if (!label) return select

  return (
    <div className="wb-field">
      <label htmlFor={fieldId} className="wb-field__label">
        {label}
      </label>
      {select}
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
