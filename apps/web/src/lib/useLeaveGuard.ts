import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import type { SaveStatus } from './useAutosave'

export type LeaveProblem = 'error' | 'offline' | 'conflict'

interface Options {
  /** Destinations that count as staying in the editor (its own tabs). */
  isWithinEditor: (pathname: string) => boolean
  /** Read at navigation time: anything not yet acknowledged by the server. */
  hasUnsavedWork: () => boolean
  /** Saves pending work now; resolves with the resulting status. */
  flush: () => Promise<SaveStatus>
  /** Re-sends after a failed save; resolves with the resulting status. */
  retry: () => Promise<SaveStatus>
}

/**
 * Guards every in-app navigation out of an editor — links, View article,
 * Back/Forward, programmatic `navigate()` — through React Router's blocker.
 * Moving between the editor's own tabs is never blocked.
 *
 * On a blocked navigation the pending change is flushed (waiting for any
 * request already in flight and anything queued behind it); if the server
 * acknowledges it, the original navigation proceeds exactly once.
 * Otherwise the navigation stays paused and `problem` says why, until the
 * caller retries, stays (`keepEditing`), or leaves (`leave`). Closing or
 * reloading the browser tab is covered separately by `beforeunload`.
 */
export function useLeaveGuard({ isWithinEditor, hasUnsavedWork, flush, retry }: Options) {
  const optionsRef = useRef({ isWithinEditor, hasUnsavedWork, flush, retry })
  optionsRef.current = { isWithinEditor, hasUnsavedWork, flush, retry }

  const blocker = useBlocker(
    useCallback(
      ({ nextLocation }: { nextLocation: { pathname: string } }) =>
        !optionsRef.current.isWithinEditor(nextLocation.pathname) &&
        optionsRef.current.hasUnsavedWork(),
      [],
    ),
  )
  const [problem, setProblem] = useState<LeaveProblem | null>(null)
  const [busy, setBusy] = useState(false)
  // One save attempt per blocked navigation, however often it re-renders.
  const handledRef = useRef<typeof blocker | null>(null)

  const settle = useCallback(
    (status: SaveStatus) => {
      if (blocker.state !== 'blocked') return
      if (status === 'saved' || status === 'idle') {
        setProblem(null)
        blocker.proceed()
      } else if (status === 'error' || status === 'offline' || status === 'conflict') {
        setProblem(status)
      } else {
        setProblem('error')
      }
    },
    [blocker],
  )

  useEffect(() => {
    if (blocker.state !== 'blocked' || handledRef.current === blocker) return
    handledRef.current = blocker
    setBusy(true)
    void optionsRef.current
      .flush()
      .then(settle)
      .finally(() => setBusy(false))
  }, [blocker, settle])

  useEffect(() => {
    if (blocker.state === 'unblocked') {
      handledRef.current = null
      setProblem(null)
    }
  }, [blocker.state])

  return {
    /** A navigation is paused while saving (`busy`) or because of `problem`. */
    blocked: blocker.state === 'blocked',
    busy,
    problem,
    retry: async () => {
      setBusy(true)
      try {
        settle(await optionsRef.current.retry())
      } finally {
        setBusy(false)
      }
    },
    keepEditing: () => {
      setProblem(null)
      if (blocker.state === 'blocked') blocker.reset()
    },
    leave: () => {
      setProblem(null)
      if (blocker.state === 'blocked') blocker.proceed()
    },
  }
}
