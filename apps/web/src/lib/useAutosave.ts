import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './apiClient'
import { clearDraft, saveDraft, type DraftResourceType } from './draftDb'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'

const AUTOSAVE_DELAY_MS = 2000

interface UseAutosaveOptions<TInput extends Record<string, unknown>, TResult> {
  resourceType: DraftResourceType
  campaignId: string
  resourceId: string
  enabled: boolean
  save: (input: TInput) => Promise<TResult>
  onSaved: (result: TResult) => void
}

/** Debounces edits to an existing entity/session/plot thread, saving after
 * an idle period. On failure (offline or a stale-write 409) the pending
 * change is kept in IndexedDB rather than lost — see `draftDb.ts`.
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
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [conflictUpdatedAt, setConflictUpdatedAt] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (input: TInput) => {
      if (!enabled) return
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        void (async () => {
          setStatus('saving')
          try {
            const result = await save(input)
            await clearDraft(resourceType, campaignId, resourceId)
            onSaved(result)
            setStatus('saved')
          } catch (error) {
            await saveDraft(resourceType, campaignId, resourceId, input)
            if (error instanceof ApiError && error.status === 409) {
              const conflictBody = error.body as { currentUpdatedAt?: string } | undefined
              setConflictUpdatedAt(conflictBody?.currentUpdatedAt ?? null)
              setStatus('conflict')
            } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
              setStatus('offline')
            } else {
              setStatus('error')
            }
          }
        })()
      }, AUTOSAVE_DELAY_MS)
    },
    [resourceType, campaignId, resourceId, enabled, save, onSaved],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const resolveConflict = useCallback(() => {
    setStatus('idle')
    setConflictUpdatedAt(null)
  }, [])

  return { status, conflictUpdatedAt, scheduleSave, resolveConflict }
}
