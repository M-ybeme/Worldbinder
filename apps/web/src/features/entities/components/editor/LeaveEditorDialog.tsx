import { Button, Dialog } from '@worldbinder/ui'

import type { LeaveProblem } from '../../../../lib/useLeaveGuard'

const TITLES: Record<LeaveProblem, string> = {
  error: 'Your latest changes couldn’t be saved',
  offline: 'You’re offline',
  conflict: 'This entry was changed elsewhere',
}

/**
 * Shown when leaving the editor (any link, Back/Forward, View article,
 * switching campaign) while the latest changes aren't on the server. The
 * destination is kept; "Keep editing" (or Escape) stays put with nothing
 * lost. Leaving is only offered once the change is confirmed to be stored
 * on this device — and the wording says plainly that it isn't synced.
 */
export function LeaveEditorDialog({
  open,
  problem,
  draftStored,
  retrying,
  onRetry,
  onKeepEditing,
  onLeave,
  onReview,
}: {
  open: boolean
  problem: LeaveProblem
  draftStored: boolean
  retrying: boolean
  onRetry: () => void
  onKeepEditing: () => void
  onLeave: () => void
  onReview: () => void
}) {
  return (
    <Dialog open={open} onClose={onKeepEditing} title={TITLES[problem]} className="wb-leave-dialog">
      <div className="wb-leave-dialog__body">
        {problem === 'error' && (
          <p>The server didn’t accept your latest changes, so they aren’t saved yet.</p>
        )}
        {problem === 'offline' && (
          <p>
            Your latest changes haven’t reached the server. They won’t sync on their own when you’re
            back online — reopen this editor and they’ll be offered back so you can save them.
          </p>
        )}
        {problem === 'conflict' && (
          <p>
            Someone saved a newer version while you were editing, and your changes aren’t saved.
            Review the differences to choose which version to keep.
          </p>
        )}
        {draftStored ? (
          <p className="wb-leave-dialog__note">
            {problem === 'conflict'
              ? 'If you leave now, your version is kept on this device only; the saved version is unchanged.'
              : 'A copy is stored on this device, so leaving won’t lose it — but it isn’t on the server.'}
          </p>
        ) : (
          <p className="wb-leave-dialog__note wb-leave-dialog__note--warning">
            This device couldn’t store a copy, so leaving now would lose these changes.
          </p>
        )}
        <div className="wb-leave-dialog__actions">
          {problem === 'conflict' ? (
            <Button onClick={onReview}>Review differences</Button>
          ) : (
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? 'Trying…' : 'Try again'}
            </Button>
          )}
          <Button variant="secondary" onClick={onKeepEditing}>
            Keep editing
          </Button>
          {draftStored && (
            <Button variant="secondary" onClick={onLeave}>
              {problem === 'conflict'
                ? 'Leave, keep mine on this device'
                : 'Leave, keep on this device'}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
