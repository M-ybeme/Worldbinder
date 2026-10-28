import { Button } from '@worldbinder/ui'
import type { SaveStatus } from '../../lib/useAutosave'
import { ConflictDialog, type ServerVersionSummary } from './ConflictDialog'
import { LeaveEditorDialog } from './LeaveEditorDialog'
import type { EditorSafety } from './useEditorSafety'
import './editorSafety.css'

/**
 * The conflict banner, the conflict comparison and the leave dialog, wired
 * to `useEditorSafety` — the same for every editor; only `describe` (which
 * fields differ) and the record's noun change.
 */
export function EditorSafetyPanels<TServer extends { updatedAt: string }>({
  safety,
  status,
  campaignId,
  recordNoun,
  describe,
}: {
  safety: EditorSafety<TServer>
  status: SaveStatus
  campaignId: string
  recordNoun: string
  describe: (record: TServer) => ServerVersionSummary
}) {
  const { guard, conflict, draftStored } = safety
  return (
    <>
      {status === 'conflict' && (
        <div className="wb-banner wb-banner--warning">
          <p>
            Someone else saved this {recordNoun} while you were editing. Your changes aren’t saved
            yet.
          </p>
          <Button onClick={conflict.openConflict}>Review differences</Button>
        </div>
      )}

      {conflict.open && (
        <ConflictDialog
          key={conflict.server.status === 'ready' ? conflict.server.record.updatedAt : 'pending'}
          open
          campaignId={campaignId}
          recordNoun={recordNoun}
          server={conflict.server}
          describe={describe}
          pending={conflict.resolving}
          changedAgain={conflict.changedAgain}
          onKeepEditing={conflict.close}
          onRetryLoad={conflict.retryLoad}
          onKeepMine={conflict.keepMine}
          onLoadServer={conflict.loadServer}
        />
      )}

      <LeaveEditorDialog
        open={guard.problem !== null}
        problem={guard.problem ?? 'error'}
        recordNoun={recordNoun}
        draftStored={draftStored}
        retrying={guard.busy}
        onRetry={() => void guard.retry()}
        onKeepEditing={guard.keepEditing}
        onLeave={guard.leave}
        onReview={() => {
          guard.keepEditing()
          conflict.openConflict()
        }}
      />
    </>
  )
}
