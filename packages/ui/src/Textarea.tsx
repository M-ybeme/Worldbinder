import { forwardRef, type TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, name, ...props },
  ref,
) {
  const fieldId = id ?? name
  return (
    <div className="wb-field">
      <label htmlFor={fieldId} className="wb-field__label">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        name={name}
        className="wb-field__input"
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
