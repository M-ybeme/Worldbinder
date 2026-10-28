import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../lib/apiClient'
import type { useAutosave } from '../../lib/useAutosave'
import type { ServerVersionState } from './ConflictDialog'
import { useLeaveGuard } from './useLeaveGuard'

type Autosave = ReturnType<typeof useAutosave<Record<string, unknown>, unknown>>

interface Options<TServer extends { updatedAt: string }, TInput> {
  autosave: Pick<
    Autosave,
    'status' | 'flush' | 'retry' | 'hasUnsavedWork' | 'hasLocalDraft' | 'resolveConflict'
  > & { acceptServerVersion: (baseline: TInput) => Promise<void> }
  /** Paths that count as staying in the editor (e.g. its own tabs). */
  isWithinEditor: (pathname: string) => boolean
  /** The record's current server version, via its normal permission-checked
   * endpoint. */
  fetchServer: () => Promise<TServer>
  /** "Keep my changes": point the editor's version token at `server` and
   * schedule a save of the local values against it. */
  applyKeepMine: (server: TServer) => void
  /** "Load saved version": replace the editor's state with `server` and
   * return the save payload it now corresponds to (the new baseline). */
  applyServer: (server: TServer) => TInput
}

/**
 * The editing-safety lifecycle shared by the entity, session and plot-thread
 * editors, on top of `useAutosave`: the leave guard (save-before-leaving,
 * pausing on failure/offline/conflict), whether a local draft is confirmed
 * for the leave dialog, and the conflict state machine — fetch the server
 * version, keep mine against exactly the version reviewed (a further change
 * shows new differences rather than being overwritten), or load the server
 * version as the new baseline. Field-specific work stays in each editor.
 */
export function useEditorSafety<TServer extends { updatedAt: string }, TInput>({
  autosave,
  isWithinEditor,
  fetchServer,
  applyKeepMine,
  applyServer,
}: Options<TServer, TInput>) {
  const guard = useLeaveGuard({
    isWithinEditor,
    hasUnsavedWork: autosave.hasUnsavedWork,
    flush: autosave.flush,
    retry: autosave.retry,
  })
  const [draftStored, setDraftStored] = useState(false)
  const [open, setOpen] = useState(false)
  const [server, setServer] = useState<ServerVersionState<TServer>>({ status: 'loading' })
  const [resolving, setResolving] = useState(false)
  const [changedAgain, setChangedAgain] = useState(false)

  useEffect(() => {
    if (!guard.problem) return
    let cancelled = false
    void autosave.hasLocalDraft().then((stored) => {
      if (!cancelled) setDraftStored(stored)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.problem])

  const loadServerVersion = useCallback(async () => {
    setServer({ status: 'loading' })
    try {
      const record = await fetchServer()
      setServer({ status: 'ready', record })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        setServer({ status: 'unavailable' })
      } else {
        setServer({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }, [fetchServer])

  function openConflict() {
    setChangedAgain(false)
    setOpen(true)
    void loadServerVersion()
  }

  async function keepMine(record: TServer) {
    setResolving(true)
    applyKeepMine(record)
    autosave.resolveConflict()
    const result = await autosave.flush()
    setResolving(false)
    if (result === 'conflict') {
      setChangedAgain(true)
      await loadServerVersion()
    } else {
      setOpen(false)
    }
  }

  async function loadServer(record: TServer) {
    setResolving(true)
    const baseline = applyServer(record)
    await autosave.acceptServerVersion(baseline)
    setResolving(false)
    setOpen(false)
  }

  return {
    guard,
    draftStored,
    conflict: {
      open,
      server,
      resolving,
      changedAgain,
      openConflict,
      close: () => setOpen(false),
      retryLoad: () => void loadServerVersion(),
      keepMine: (record: TServer) => void keepMine(record),
      loadServer: (record: TServer) => void loadServer(record),
    },
  }
}

export type EditorSafety<TServer extends { updatedAt: string }> = ReturnType<
  typeof useEditorSafety<TServer, unknown>
>
