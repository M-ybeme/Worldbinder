import type { ReactNode } from 'react'

export interface EmptyStateProps {
  message: string
  action?: ReactNode
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="wb-empty-state">
      <p>{message}</p>
      {action}
    </div>
  )
}
