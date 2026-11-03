import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './apiClient'
import { clearDraft, saveDraft, type DraftResourceType } from './draftDb'

/** `pending` = changed locally, waiting for the debounce; the change is
 * already in IndexedDB but not yet on the server. Never shown as saved. */
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'

const AUTOSAVE_DELAY_MS = 2000

interface UseAutosaveOptions<TInput extends Record<string, unknown>, TResult> {
  resourceType: DraftResourceType
  campaignId: string
  resourceId: string
  enabled: boolean
  save: (input: TInput) => Promise<TResult>
  onSaved: (result: TResult) => void
}

/** Input content minus the optimistic-concurrency token, so a re-render that
 * only bumps `updatedAt` (every consumer's `onSaved` does) isn't mistaken
 * for a new edit — without this, each successful save scheduled another
 * identical one two seconds later, forever. */
function contentKey(input: Record<string, unknown>): string {
  return JSON.stringify({ ...input, updatedAt: undefined })
}

/** Debounces edits to an existing entity/session/plot thread, saving after
 * an idle period. Every change is written to IndexedDB immediately (see
 * `draftDb.ts`) and cleared only once the server has the latest content, so
 * a change survives navigation, a closed tab, a failed request, being
 * offline, or a stale-write 409 — the next visit offers the draft back.
 * Saves run one at a time; a save queued behind an in-flight one is sent
 * with the version that in-flight save produced rather than the stale one
 * it was built with. `flush()` saves now and resolves with the final
 * status; unmounting with a pending change flushes it.
 * Generalized from the entity-only `useEntityAutosave` so sessions and
 * plot threads get the same real autosave behavior entities already had,
 * not just the debounce-and-save half without the offline-resilience half. */
export function useAutosave<TInput extends Record<string, unknown>, TResult>({
  resourceType,
  campaignId,
  resourceId,
  enabled,
  save,
  onSaved,
}: UseAutosaveOptions<TInput, TResult>) {
  const [status, setStatusState] = useState<SaveStatus>('idle')
  const [conflictUpdatedAt, setConflictUpdatedAt] = useState<string | null>(null)
  const statusRef = useRef<SaveStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest edit not yet sent to the server.
  const pendingRef = useRef<TInput | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  // Content (minus version) of the request in flight.
  const inFlightKeyRef = useRef<string | null>(null)
  const lastSavedKeyRef = useRef<string | null>(null)
  // Version a save was sent with -> version the server returned. Lets a
  // queued input built against an already-superseded version of our own be
  // brought up to date, without touching a version from elsewhere (e.g. a
  // conflict's "keep my changes", which deliberately sends the server's).
  const versionMapRef = useRef(new Map<string, string>())
  // IndexedDB writes/clears run in order, so a slow write can't land after
  // the clear that should have removed it.
  const draftQueueRef = useRef<Promise<void>>(Promise.resolve())
  // Whether the latest local copy is confirmed written to IndexedDB —
  // callers may only offer "leave, keep on this device" when it is.
  const draftStateRef = useRef<'none' | 'stored' | 'failed'>('none')
  const mountedRef = useRef(true)

  // Kept in refs so the unmount flush uses the latest callbacks/target.
  const optionsRef = useRef({ resourceType, campaignId, resourceId, enabled, save, onSaved })
  optionsRef.current = { resourceType, campaignId, resourceId, enabled, save, onSaved }

  const setStatus = useCallback((next: SaveStatus) => {
    statusRef.current = next
    if (mountedRef.current) setStatusState(next)
  }, [])

  // Local draft writes run one at a time, and only the newest waiting one is
  // kept: each write replaces the whole draft, so the ones in between would
  // be overwritten anyway. Chaining every keystroke's write instead built a
  // backlog on slow storage (WebKit, phones) that a finished save had to
  // wait out before reporting "Saved" or sending the next change.
  const nextDraftOpRef = useRef<{ op: 'save' | 'clear'; input?: TInput } | null>(null)
  const draftRunningRef = useRef(false)

  const queueDraft = useCallback((op: 'save' | 'clear', input?: TInput) => {
    nextDraftOpRef.current = { op, input }
    if (draftRunningRef.current) return draftQueueRef.current
    draftRunningRef.current = true
    draftQueueRef.current = (async () => {
      try {
        for (let next = nextDraftOpRef.current; next; next = nextDraftOpRef.current) {
          nextDraftOpRef.current = null
          const { resourceType: type, campaignId: campaign, resourceId: id } = optionsRef.current
          try {
            if (next.op === 'save' && next.input) await saveDraft(type, campaign, id, next.input)
            else await clearDraft(type, campaign, id)
            draftStateRef.current = next.op === 'save' ? 'stored' : 'none'
          } catch {
            // Local storage unavailable (private mode, quota): the server
            // save still runs; there's just no offline copy to fall back on.
            if (next.op === 'save') draftStateRef.current = 'failed'
          }
        }
      } finally {
        draftRunningRef.current = false
      }
    })()
    return draftQueueRef.current
  }, [])

  const withCurrentVersion = useCallback((input: TInput): TInput => {
    const sentWith = input.updatedAt
    if (typeof sentWith !== 'string') return input
    let version: string = sentWith
    const seen = new Set<string>()
    while (versionMapRef.current.has(version) && !seen.has(version)) {
      seen.add(version)
      version = versionMapRef.current.get(version) as string
    }
    return version === input.updatedAt ? input : { ...input, updatedAt: version }
  }, [])

  const sendPending = useCallback((): Promise<void> => {
    if (inFlightRef.current || !pendingRef.current) return inFlightRef.current ?? Promise.resolve()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const input = withCurrentVersion(pendingRef.current)
    pendingRef.current = null
    inFlightKeyRef.current = contentKey(input)
    if (statusRef.current !== 'conflict') setStatus('saving')

    const flight = (async () => {
      try {
        const result = await optionsRef.current.save(input)
        const returned = (result as { updatedAt?: unknown } | null)?.updatedAt
        if (typeof input.updatedAt === 'string' && typeof returned === 'string') {
          versionMapRef.current.set(input.updatedAt, returned)
        }
        lastSavedKeyRef.current = contentKey(input)
        if (!pendingRef.current) await queueDraft('clear')
        optionsRef.current.onSaved(result)
        setStatus(pendingRef.current ? 'pending' : 'saved')
        if (mountedRef.current) setConflictUpdatedAt(null)
      } catch (error) {
        // The newest local content wins: an edit typed while this request
        // was in flight is already in IndexedDB and must not be replaced by
        // the older input that just failed.
        if (!pendingRef.current) await queueDraft('save', input)
        const isConflict = error instanceof ApiError && error.status === 409
        // Keep a failed (non-conflict) input queued so `retry()` can resend
        // it; a conflict's input is stale and waits for the user's choice.
        if (!isConflict && !pendingRef.current) pendingRef.current = input
        if (isConflict) {
          const conflictBody = error.body as { currentUpdatedAt?: string } | undefined
          if (mountedRef.current) setConflictUpdatedAt(conflictBody?.currentUpdatedAt ?? null)
          setStatus('conflict')
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setStatus('offline')
        } else {
          setStatus('error')
        }
      } finally {
        inFlightRef.current = null
        inFlightKeyRef.current = null
      }
    })()
    inFlightRef.current = flight
    return flight
  }, [queueDraft, setStatus, withCurrentVersion])

  const scheduleSave = useCallback(
    (input: TInput) => {
      if (!enabled) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null

      // Only the concurrency token changed (our own save's onSaved) or the
      // edit was undone back to what the server already has: nothing to do.
      if (contentKey(input) === lastSavedKeyRef.current && !inFlightRef.current) {
        if (pendingRef.current) {
          pendingRef.current = null
          void queueDraft('clear')
          if (statusRef.current === 'pending') setStatus('saved')
        }
        return
      }

      // Identical to the request already in flight — only the version token
      // differs (the re-render from a previous save's onSaved can land
      // while flush() is already sending the next one). Queuing it would
      // resend the same content after every save, forever.
      if (inFlightRef.current && contentKey(input) === inFlightKeyRef.current) {
        if (pendingRef.current) {
          // A pending edit was undone back to what's being sent.
          pendingRef.current = null
          void queueDraft('save', input)
          if (statusRef.current === 'pending') setStatus('saving')
        }
        return
      }

      pendingRef.current = input
      void queueDraft('save', input)
      if (statusRef.current !== 'conflict') setStatus('pending')

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (inFlightRef.current) {
          // Send once the current request settles, with its new version.
          void inFlightRef.current.then(() => {
            if (statusRef.current !== 'conflict') return sendPending()
          })
          return
        }
        void sendPending()
      }, AUTOSAVE_DELAY_MS)
    },
    [enabled, queueDraft, sendPending, setStatus],
  )

  /** Saves any pending change now and waits for it (and anything already in
   * flight) to settle. Resolves with the resulting status — callers leaving
   * the editor should only proceed on `saved` or `idle`. */
  const flush = useCallback(async (): Promise<SaveStatus> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    for (;;) {
      if (inFlightRef.current) {
        await inFlightRef.current
        continue
      }
      const failed = ['offline', 'error', 'conflict'].includes(statusRef.current)
      if (pendingRef.current && optionsRef.current.enabled && !failed) {
        await sendPending()
        continue
      }
      break
    }
    await draftQueueRef.current
    return pendingRef.current && statusRef.current === 'pending' ? 'pending' : statusRef.current
  }, [sendPending])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Leaving the editor (link click, Back, route change) with a change
      // still waiting for the debounce: send it now instead of dropping it.
      // It is already in IndexedDB, so if this request fails or the page is
      // closed first, the next visit offers it back as a draft.
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        if (pendingRef.current && statusRef.current !== 'conflict') void flush()
      }
    }
  }, [flush])

  /** Re-sends after a failed (`error`/`offline`) save, then waits like
   * `flush()`. A conflict isn't retried — it needs the user's choice. */
  const retry = useCallback(async (): Promise<SaveStatus> => {
    if (statusRef.current === 'error' || statusRef.current === 'offline') {
      setStatus(pendingRef.current ? 'pending' : 'idle')
    }
    return flush()
  }, [flush, setStatus])

  /** Anything the server hasn't acknowledged: a debounced or queued edit, a
   * request in flight, or a failed/conflicting save. Reads refs, so it's
   * accurate at navigation time even between renders. */
  const hasUnsavedWork = useCallback(
    () =>
      pendingRef.current !== null ||
      inFlightRef.current !== null ||
      timerRef.current !== null ||
      ['error', 'offline', 'conflict'].includes(statusRef.current),
    [],
  )

  /** Whether the latest local change is confirmed stored in IndexedDB. */
  const hasLocalDraft = useCallback(async (): Promise<boolean> => {
    await draftQueueRef.current
    return draftStateRef.current === 'stored'
  }, [])

  /** The user chose the server's version over their own (conflict "load
   * saved version"): drop pending work and the local draft, and treat
   * `baseline` — the server's content, as the caller will now show it — as
   * saved, so re-hydrating doesn't schedule a redundant save. */
  const acceptServerVersion = useCallback(
    async (baseline: TInput) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingRef.current = null
      lastSavedKeyRef.current = contentKey(baseline)
      setConflictUpdatedAt(null)
      setStatus('idle')
      await queueDraft('clear')
    },
    [queueDraft, setStatus],
  )

  const resolveConflict = useCallback(() => {
    setStatus(pendingRef.current ? 'pending' : 'idle')
    setConflictUpdatedAt(null)
    // A "keep my changes" input scheduled while the conflict was showing
    // was held back; send it on the normal debounce now.
    if (pendingRef.current && !timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void sendPending()
      }, AUTOSAVE_DELAY_MS)
    }
  }, [sendPending, setStatus])

  return {
    status,
    conflictUpdatedAt,
    scheduleSave,
    resolveConflict,
    flush,
    retry,
    hasUnsavedWork,
    hasLocalDraft,
    acceptServerVersion,
  }
}
