import { act, renderHook } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient'
import { clearDraft, saveDraft } from './draftDb'
import { useAutosave } from './useAutosave'

vi.mock('./draftDb', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
  clearDraft: vi.fn(() => Promise.resolve()),
}))

const AUTOSAVE_DELAY_MS = 2000

interface Input extends Record<string, unknown> {
  summary: string
  updatedAt: string
}
interface Result {
  updatedAt: string
}

/** Mirrors how EntityFormPage / SessionFormPage / ThreadFormPage wire the
 * hook: the first post-hydration effect run is skipped, every field change
 * (and every `updatedAt` change from `onSaved`) re-runs the effect that
 * calls `scheduleSave` with a freshly built input. */
function useEditorLike(save: (input: Input) => Promise<Result>) {
  const [summary, setSummary] = useState('original')
  const [updatedAt, setUpdatedAt] = useState('v0')
  const skipNextAutosaveRef = useRef(true)
  const autosave = useAutosave<Input, Result>({
    resourceType: 'entity',
    campaignId: 'campaign-1',
    resourceId: 'entity-1',
    enabled: true,
    save,
    onSaved: (result) => setUpdatedAt(result.updatedAt),
  })
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    autosave.scheduleSave({ summary, updatedAt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, updatedAt])
  return { autosave, setSummary, updatedAt }
}

/** A save function backed by a fake server with optimistic concurrency:
 * rejects with 409 when the sent `updatedAt` isn't the current version,
 * exactly like the API's entity/session/plot-thread update endpoints. */
function fakeServer() {
  let version = 0
  const saved: Input[] = []
  const save = vi.fn(async (input: Input): Promise<Result> => {
    if (input.updatedAt !== `v${version}`) {
      throw new ApiError('Conflict', 409, { currentUpdatedAt: `v${version}` })
    }
    version += 1
    saved.push(input)
    return { updatedAt: `v${version}` }
  })
  return { save, saved, currentVersion: () => `v${version}` }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(saveDraft).mockClear()
  vi.mocked(clearDraft).mockClear()
  setOnline(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutosave', () => {
  it('reports unsaved changes as soon as content changes, never "saved"', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('first edit'))
    await advance(AUTOSAVE_DELAY_MS)
    await advance(0)
    expect(result.current.autosave.status).toBe('saved')

    act(() => result.current.setSummary('second edit'))
    expect(result.current.autosave.status).toBe('pending')
  })

  it('debounces rapid consecutive edits into one save of the latest content', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))

    for (const text of ['a', 'ab', 'abc', 'abcd']) {
      act(() => result.current.setSummary(text))
      await advance(500)
    }
    await advance(AUTOSAVE_DELAY_MS)

    expect(server.save).toHaveBeenCalledTimes(1)
    expect(server.saved[0]?.summary).toBe('abcd')
  })

  it('does not keep re-saving unchanged content after a successful save', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('edited once'))
    // Separate act() calls so the effect that onSaved's setUpdatedAt
    // re-triggers actually runs between steps, as it would in the browser.
    for (let i = 0; i < 10; i += 1) await advance(AUTOSAVE_DELAY_MS)

    expect(server.save).toHaveBeenCalledTimes(1)
    expect(result.current.autosave.status).toBe('saved')
  })

  it('writes a local draft as soon as a change is made, before any network request', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('typed'))
    await advance(0) // let the queued IndexedDB write run; no timer time passes

    expect(server.save).not.toHaveBeenCalled()
    expect(saveDraft).toHaveBeenLastCalledWith(
      'entity',
      'campaign-1',
      'entity-1',
      expect.objectContaining({ summary: 'typed' }),
    )
  })

  it('saves a pending change when the editor unmounts immediately after typing', async () => {
    const server = fakeServer()
    const { result, unmount } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('typed then left'))
    unmount()
    await advance(0)

    expect(server.saved.map((s) => s.summary)).toEqual(['typed then left'])
  })

  it('saves a pending change when the editor unmounts partway through the debounce', async () => {
    const server = fakeServer()
    const { result, unmount } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('typed then left later'))
    await advance(AUTOSAVE_DELAY_MS - 500)
    unmount()
    await advance(0)

    expect(server.saved.map((s) => s.summary)).toEqual(['typed then left later'])
  })

  it('flush() saves immediately and resolves with the final status', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))

    act(() => result.current.setSummary('done clicked right away'))
    let finalStatus: string | undefined
    await act(async () => {
      finalStatus = await result.current.autosave.flush()
    })

    expect(finalStatus).toBe('saved')
    expect(server.saved.map((s) => s.summary)).toEqual(['done clicked right away'])
  })

  it('serializes edits made while a save is in flight and sends them with the new version', async () => {
    const server = fakeServer()
    let releaseFirst: () => void = () => {}
    const slowSave = vi.fn(async (input: Input) => {
      if (slowSave.mock.calls.length === 1) {
        await new Promise<void>((resolve) => (releaseFirst = resolve))
      }
      return server.save(input)
    })
    const { result } = renderHook(() => useEditorLike(slowSave))

    act(() => result.current.setSummary('first'))
    await advance(AUTOSAVE_DELAY_MS)
    expect(result.current.autosave.status).toBe('saving')

    // Typed while the first request is still in flight, and the debounce
    // for this edit elapses before the first request returns.
    act(() => result.current.setSummary('second'))
    await advance(AUTOSAVE_DELAY_MS * 2)
    expect(result.current.autosave.status).not.toBe('saved')

    await act(async () => releaseFirst())
    await advance(AUTOSAVE_DELAY_MS)

    expect(server.saved.map((s) => s.summary)).toEqual(['first', 'second'])
    expect(result.current.autosave.status).toBe('saved')
  })

  it('keeps the latest change locally and reports an error when the save fails', async () => {
    const save = vi.fn(async (): Promise<Result> => {
      throw new ApiError('Internal Server Error', 500)
    })
    const { result } = renderHook(() => useEditorLike(save))

    act(() => result.current.setSummary('will fail'))
    await advance(AUTOSAVE_DELAY_MS)

    expect(result.current.autosave.status).toBe('error')
    expect(saveDraft).toHaveBeenLastCalledWith(
      'entity',
      'campaign-1',
      'entity-1',
      expect.objectContaining({ summary: 'will fail' }),
    )
    expect(clearDraft).not.toHaveBeenCalled()
  })

  it('keeps offline edits locally and reports offline', async () => {
    setOnline(false)
    const save = vi.fn(async (): Promise<Result> => {
      throw new TypeError('Failed to fetch')
    })
    const { result } = renderHook(() => useEditorLike(save))

    act(() => result.current.setSummary('written offline'))
    await advance(AUTOSAVE_DELAY_MS)

    expect(result.current.autosave.status).toBe('offline')
    expect(saveDraft).toHaveBeenLastCalledWith(
      'entity',
      'campaign-1',
      'entity-1',
      expect.objectContaining({ summary: 'written offline' }),
    )
    expect(clearDraft).not.toHaveBeenCalled()
  })

  it('does not clear a newer local draft when an older save succeeds', async () => {
    const server = fakeServer()
    let releaseFirst: () => void = () => {}
    const slowSave = vi.fn(async (input: Input) => {
      if (slowSave.mock.calls.length === 1) {
        await new Promise<void>((resolve) => (releaseFirst = resolve))
      }
      return server.save(input)
    })
    const { result, unmount } = renderHook(() => useEditorLike(slowSave))

    act(() => result.current.setSummary('first'))
    await advance(AUTOSAVE_DELAY_MS)
    act(() => result.current.setSummary('newer, not sent yet'))
    vi.mocked(clearDraft).mockClear()
    await act(async () => releaseFirst())
    await advance(0)

    // The first save landed, but "newer, not sent yet" only exists locally.
    expect(clearDraft).not.toHaveBeenCalled()
    unmount()
  })

  it('reports a concurrent-modification conflict and keeps the change locally', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))
    // Someone else saves first, so our next save is stale.
    await server.save({ summary: 'their edit', updatedAt: 'v0' })

    act(() => result.current.setSummary('my edit'))
    await advance(AUTOSAVE_DELAY_MS)

    expect(result.current.autosave.status).toBe('conflict')
    expect(result.current.autosave.conflictUpdatedAt).toBe('v1')
    expect(saveDraft).toHaveBeenLastCalledWith(
      'entity',
      'campaign-1',
      'entity-1',
      expect.objectContaining({ summary: 'my edit' }),
    )
    // The conflict must not be papered over by our own retries.
    expect(server.saved.map((s) => s.summary)).toEqual(['their edit'])
  })

  it('lets "keep my changes" save over the conflict using the server version', async () => {
    const server = fakeServer()
    const { result } = renderHook(() => useEditorLike(server.save))
    await server.save({ summary: 'their edit', updatedAt: 'v0' })

    act(() => result.current.setSummary('my edit'))
    await advance(AUTOSAVE_DELAY_MS)
    expect(result.current.autosave.status).toBe('conflict')

    // What the form pages' "Keep my changes" button does.
    act(() => {
      result.current.autosave.scheduleSave({ summary: 'my edit', updatedAt: 'v1' })
      result.current.autosave.resolveConflict()
    })
    await advance(AUTOSAVE_DELAY_MS)

    expect(server.saved.map((s) => s.summary)).toEqual(['their edit', 'my edit'])
    expect(result.current.autosave.status).toBe('saved')
  })
})
