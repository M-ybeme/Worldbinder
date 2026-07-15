import { Button } from './Button'

export interface ErrorStateProps {
  message?: string | null
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="wb-error-state" role="alert">
      <p>{message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
