export interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <p className="wb-loading-state" role="status" aria-live="polite">
      <span className="wb-loading-state__spinner" aria-hidden="true" />
      {label}
    </p>
  )
}
