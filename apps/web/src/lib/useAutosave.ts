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
  const lastSavedKeyRef = useRef<string | null>(null)
  // Version a save was sent with -> version the server returned. Lets a
  // queued input built against an already-superseded version of our own be
  // brought up to date, without touching a version from elsewhere (e.g. a
  // conflict's "keep my changes", which deliberately sends the server's).
  const versionMapRef = useRef(new Map<string, string>())
  // IndexedDB writes/clears run in order, so a slow write can't land after
  // the clear that should have removed it.
  const draftQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mountedRef = useRef(true)

  // Kept in refs so the unmount flush uses the latest callbacks/target.
  const optionsRef = useRef({ resourceType, campaignId, resourceId, enabled, save, onSaved })
  optionsRef.current = { resourceType, campaignId, resourceId, enabled, save, onSaved }

  const setStatus = useCallback((next: SaveStatus) => {
    statusRef.current = next
    if (mountedRef.current) setStatusState(next)
  }, [])

  const queueDraft = useCallback((op: 'save' | 'clear', input?: TInput) => {
    const { resourceType: type, campaignId: campaign, resourceId: id } = optionsRef.current
    draftQueueRef.current = draftQueueRef.current
      .then(() =>
        op === 'save' && input
          ? saveDraft(type, campaign, id, input)
          : clearDraft(type, campaign, id),
      )
      .catch(() => {
        // Local storage unavailable (private mode, quota): the server save
        // still runs; there's just no offline copy to fall back on.
      })
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
        if (error instanceof ApiError && error.status === 409) {
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

  return { status, conflictUpdatedAt, scheduleSave, resolveConflict, flush }
}
