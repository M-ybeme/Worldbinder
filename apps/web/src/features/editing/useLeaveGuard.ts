import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import type { SaveStatus } from '../../lib/useAutosave'

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
  // Always act on the router's current blocker: a repeated navigation while
  // paused replaces it, and proceeding a superseded one is invalid.
  const blockerRef = useRef(blocker)
  blockerRef.current = blocker
  // One save attempt per paused navigation — repeated clicks (each a new
  // blocker object) don't start another save or a second proceed().
  const activeRef = useRef(false)

  const settle = useCallback((status: SaveStatus) => {
    const current = blockerRef.current
    if (current.state !== 'blocked') return
    if (status === 'saved' || status === 'idle') {
      setProblem(null)
      current.proceed()
    } else if (status === 'error' || status === 'offline' || status === 'conflict') {
      setProblem(status)
    } else {
      setProblem('error')
    }
  }, [])

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      activeRef.current = false
      if (blocker.state === 'unblocked') setProblem(null)
      return
    }
    if (activeRef.current) return
    activeRef.current = true
    setBusy(true)
    void optionsRef.current
      .flush()
      .then(settle)
      .finally(() => setBusy(false))
  }, [blocker, settle])

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
      if (blockerRef.current.state === 'blocked') blockerRef.current.reset()
    },
    leave: () => {
      setProblem(null)
      if (blockerRef.current.state === 'blocked') blockerRef.current.proceed()
    },
  }
}
