interface FormMessageProps {
  tone?: 'error' | 'success'
  message?: string | null
}

export function FormMessage({ tone = 'error', message }: FormMessageProps) {
  if (!message) return null
  return (
    <p className={`wb-form-message wb-form-message--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  )
}
