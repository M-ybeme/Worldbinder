import type { EntityDetail } from '@worldbinder/contracts'
import type { UpdateEntityInput } from '@worldbinder/validation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import * as entitiesApi from '../api/entitiesApi'
import { clearDraft, saveDraft } from '../lib/draftDb'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'

const AUTOSAVE_DELAY_MS = 2000

interface UseEntityAutosaveOptions {
  campaignId: string
  entityId: string
  enabled: boolean
  onSaved: (entity: EntityDetail) => void
}

/** Debounces edits to an existing entity, PATCHing after an idle period.
 * On failure (offline or a stale-write 409) the pending change is kept in
 * IndexedDB rather than lost — see `lib/draftDb.ts`. */
export function useEntityAutosave({
  campaignId,
  entityId,
  enabled,
  onSaved,
}: UseEntityAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [conflictUpdatedAt, setConflictUpdatedAt] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (input: UpdateEntityInput) => {
      if (!enabled) return
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        void (async () => {
          setStatus('saving')
          try {
            const result = await entitiesApi.updateEntity(campaignId, entityId, input)
            await clearDraft(campaignId, entityId)
            onSaved(result)
            setStatus('saved')
          } catch (error) {
            await saveDraft(campaignId, entityId, input)
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
    [campaignId, entityId, enabled, onSaved],
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
