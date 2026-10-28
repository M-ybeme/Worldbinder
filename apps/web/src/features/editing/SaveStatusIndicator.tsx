import {
  AlertTriangle,
  Check,
  Circle,
  CloudOff,
  GitCompareArrows,
  LoaderCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { SaveStatus } from '../../lib/useAutosave'

const LABELS: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Waiting to save…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Couldn’t save',
  offline: 'Offline — saved on this device',
  conflict: 'Changed elsewhere',
}

const ICONS: Partial<Record<SaveStatus, ReactNode>> = {
  pending: <Circle size={12} aria-hidden="true" />,
  saving: <LoaderCircle size={14} aria-hidden="true" className="wb-save-state__spin" />,
  saved: <Check size={14} aria-hidden="true" />,
  error: <AlertTriangle size={14} aria-hidden="true" />,
  offline: <CloudOff size={14} aria-hidden="true" />,
  conflict: <GitCompareArrows size={14} aria-hidden="true" />,
}

// Spoken once per transition. Pending/saving aren't announced — they
// change on every pause in typing — only the outcomes are.
const POLITE: Partial<Record<SaveStatus, string>> = {
  saved: 'All changes synced to the server.',
}
const ALERTS: Partial<Record<SaveStatus, string>> = {
  error: 'Your latest changes couldn’t be saved to the server.',
  offline: 'You’re offline. Your changes are stored on this device only, not on the server.',
  conflict:
    'This entry was changed elsewhere. Review the differences before your changes go through.',
}

/**
 * The editor's save state. "Saved" means the server acknowledged the
 * latest changes — never while newer ones are pending (the hook reports
 * `pending` then). Local-only persistence (offline) never uses success
 * styling. Each state has an icon and words, not just a color.
 */
export function SaveStatusIndicator({
  status,
  onRetry,
  onReview,
}: {
  status: SaveStatus
  onRetry: () => void
  onReview: () => void
}) {
  return (
    <span className="wb-save-state-wrap">
      <span className={`wb-save-state wb-save-state--${status}`}>
        {ICONS[status]}
        <span className="wb-save-state__label">{LABELS[status]}</span>
        {status === 'error' && (
          <button type="button" className="wb-save-state__action" onClick={onRetry}>
            Try again
          </button>
        )}
        {status === 'conflict' && (
          <button type="button" className="wb-save-state__action" onClick={onReview}>
            Review differences
          </button>
        )}
      </span>
      <span className="wb-visually-hidden" role="status" aria-live="polite">
        {POLITE[status] ?? ''}
      </span>
      <span className="wb-visually-hidden" role="alert">
        {ALERTS[status] ?? ''}
      </span>
    </span>
  )
}
