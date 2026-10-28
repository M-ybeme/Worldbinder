import type {
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  PlotThreadDetail,
  TiptapDoc,
} from '@worldbinder/contracts'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, type ComponentType } from 'react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ApiError } from '../../lib/apiClient'
import { clearDraft, loadDraft, saveDraft } from '../../lib/draftDb'
import * as plotThreadsApi from '../plot-threads/api/plotThreadsApi'
import { ThreadFormPage } from '../plot-threads/pages/ThreadFormPage'
import * as sessionsApi from '../sessions/api/sessionsApi'
import { SessionFormPage } from '../sessions/pages/SessionFormPage'

// Real useAutosave, useEditorSafety and React Router's blocker; only the
// network, IndexedDB and heavy pickers are stubbed.
vi.mock('../../lib/draftDb', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
  clearDraft: vi.fn(() => Promise.resolve()),
  loadDraft: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock('../sessions/api/sessionsApi', () => ({ updateSession: vi.fn(), getSession: vi.fn() }))
vi.mock('../plot-threads/api/plotThreadsApi', () => ({ updatePlotThread: vi.fn(), getPlotThread: vi.fn() }))

let session: CampaignSessionDetail
let thread: PlotThreadDetail
vi.mock('../sessions/hooks/useSessions', () => ({
  useSessionQuery: () => ({ data: session, isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('../plot-threads/hooks/usePlotThreads', () => ({
  usePlotThreadQuery: () => ({ data: thread, isLoading: false, isError: false, refetch: vi.fn() }),
  usePlotThreadsQuery: () => ({ data: [] }),
}))
vi.mock('../membership/hooks/useCampaignMembers', () => ({ useMembersQuery: () => ({ data: [] }) }))
vi.mock('../tags/hooks/useTags', () => ({ useCampaignTagsQuery: () => ({ data: [] }) }))
vi.mock('../entities/hooks/useEntities', () => ({
  useReferencedEntities: () => ({ entities: new Map(), isLoading: false }),
}))
vi.mock('../entities/components/EntityMultiPicker', () => ({
  EntityMultiPicker: ({ label }: { label: string }) => <span>{label} picker</span>,
}))
vi.mock('../plot-threads/components/PlotThreadChangesEditor', () => ({
  PlotThreadChangesEditor: () => <span>thread changes editor</span>,
}))
vi.mock('../calendar/components/StructuredDateEditor', () => ({
  StructuredDateEditor: ({ legend }: { legend: string }) => <span>{legend}</span>,
}))

// TipTap stand-in: shows its (initial) content and counts mounts, like the
// real editor, which only reads `content` on mount.
const mounts: Record<string, number> = {}
vi.mock('../entities/components/RichTextEditor', () => ({
  RichTextEditor: ({
    label,
    content,
    onChange,
  }: {
    label: string
    content: TiptapDoc | null
    onChange?: (doc: TiptapDoc) => void
  }) => {
    useEffect(() => {
      mounts[label] = (mounts[label] ?? 0) + 1
    }, [label])
    const text =
      (content?.content?.[0] as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text ?? ''
    return (
      <label>
        {label}
        <textarea defaultValue={text} onChange={(e) => onChange?.(doc(e.target.value))} />
      </label>
    )
  },
}))

const AUTOSAVE_DELAY_MS = 2000

interface NodeLikeProcess {
  on: (event: string, listener: (reason: unknown) => void) => void
  off: (event: string, listener: (reason: unknown) => void) => void
}

function doc(text: string): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function makeSession(): CampaignSessionDetail {
  return {
    id: 's1',
    campaignId: 'c1',
    sessionNumber: 1,
    title: 'Into Stonewater Pass',
    status: 'planned',
    scheduledAt: null,
    playedAt: null,
    worldStartDateJson: null,
    worldEndDateJson: null,
    visibility: 'public',
    tags: [],
    createdAt: 'v0',
    updatedAt: 'v0',
    recapContentJson: doc('Old recap.'),
    plannedContentJson: null,
    gmContentJson: null,
    participants: [],
    featuredEntities: [],
    locations: [],
    reveals: [],
    plotThreadChanges: [],
  }
}

function makeThread(): PlotThreadDetail {
  return {
    id: 't1',
    campaignId: 'c1',
    title: 'The Missing Caravan',
    summary: 'A caravan vanished.',
    playerFacingStatus: 'ongoing',
    status: 'active',
    importance: 'major',
    visibility: 'public',
    lastReferencedSession: null,
    neglected: false,
    tags: [],
    createdAt: 'v0',
    updatedAt: 'v0',
    publicContentJson: doc('Old text.'),
    gmContentJson: null,
    entities: [],
    sessions: [],
  } as PlotThreadDetail
}

// The two APIs' update/get mocks have different signatures; the shared
// tests drive them through one loose type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>

interface Editor {
  name: string
  Component: ComponentType
  routePath: string
  base: string
  viewLabel: string
  richLabel: string
  oldRich: string
  recordNoun: string
  update: () => AnyMock
  get: () => AnyMock
  current: () => { title: string; updatedAt: string }
  setCurrent: (changes: Record<string, unknown>) => void
}

const editors: Editor[] = [
  {
    name: 'Session editor',
    Component: SessionFormPage,
    routePath: 'sessions/:sessionId/edit',
    base: '/app/campaign/c1/sessions/s1',
    viewLabel: 'View session',
    richLabel: 'Recap (public)',
    oldRich: 'Old recap.',
    recordNoun: 'session',
    update: () => vi.mocked(sessionsApi.updateSession) as unknown as AnyMock,
    get: () => vi.mocked(sessionsApi.getSession) as unknown as AnyMock,
    current: () => session,
    setCurrent: (changes) => {
      session = { ...session, ...changes }
    },
  },
  {
    name: 'Plot thread editor',
    Component: ThreadFormPage,
    routePath: 'threads/:threadId/edit',
    base: '/app/campaign/c1/threads/t1',
    viewLabel: 'View plot thread',
    richLabel: 'Public content',
    oldRich: 'Old text.',
    recordNoun: 'plot thread',
    update: () => vi.mocked(plotThreadsApi.updatePlotThread) as unknown as AnyMock,
    get: () => vi.mocked(plotThreadsApi.getPlotThread) as unknown as AnyMock,
    current: () => thread,
    setCurrent: (changes) => {
      thread = { ...thread, ...changes }
    },
  },
]

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
  session = makeSession()
  thread = makeThread()
  for (const key of Object.keys(mounts)) delete mounts[key]
  vi.mocked(saveDraft).mockReset().mockResolvedValue()
  vi.mocked(clearDraft).mockReset().mockResolvedValue()
  vi.mocked(loadDraft).mockReset().mockResolvedValue(undefined)
  setOnline(true)
})

afterEach(() => {
  vi.useRealTimers()
  setOnline(true)
})

describe.each(editors)('$name — editing safety', (editor) => {
  /** Optimistic concurrency like the API: 409 on a stale updatedAt.
   * `otherUserSaves` simulates someone else's save in between. */
  function fakeServer() {
    let version = 0
    const saved: Record<string, unknown>[] = []
    editor.update().mockReset().mockImplementation(async (_c: string, _id: string, input: Record<string, unknown>) => {
      if (input.updatedAt !== editor.current().updatedAt) {
        throw new ApiError('Conflict', 409, { currentUpdatedAt: editor.current().updatedAt })
      }
      version += 1
      saved.push(input)
      editor.setCurrent({ ...input, updatedAt: `v${version}` })
      return editor.current()
    })
    editor.get().mockReset().mockImplementation(async () => editor.current())
    return {
      saved,
      otherUserSaves(changes: Record<string, unknown>) {
        version += 1
        editor.setCurrent({ ...changes, updatedAt: `v${version}` })
      },
    }
  }

  function renderEditor(role: CampaignRole = 'gm') {
    const campaign = { id: 'c1', name: 'Ember', role, calendarConfigJson: null } as CampaignDetail
    const router = createMemoryRouter(
      [
        {
          path: '/app/campaign/:campaignId',
          element: <Outlet context={{ campaign }} />,
          children: [
            { path: 'sessions/:sessionId', element: <p>Record page</p> },
            { path: 'threads/:threadId', element: <p>Record page</p> },
            { path: editor.routePath, element: <editor.Component /> },
            { path: 'world', element: <p>World page</p> },
          ],
        },
      ],
      { initialEntries: [editor.base, `${editor.base}/edit`] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  const where = (router: ReturnType<typeof renderEditor>) => router.state.location.pathname
  const titleField = () => screen.getByLabelText('Title')
  const statusText = () => (document.querySelector('.wb-save-state') as HTMLElement).textContent

  it('saves a change typed just before leaving, once, then goes', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(titleField(), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: editor.viewLabel }))
    fireEvent.click(screen.getByRole('button', { name: editor.viewLabel }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(where(router)).toBe(editor.base)
  })

  it('saves before browser Back and before other in-app links', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(titleField(), { target: { value: 'Before Back' } })
    await act(() => router.navigate(-1))
    await advance(0)
    expect(server.saved.map((s) => s.title)).toEqual(['Before Back'])
    expect(where(router)).toBe(editor.base)
  })

  it('waits for a save in flight and the edit queued behind it', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    // Node's process (the test runner's), untyped in this browser tsconfig.
    const proc = (globalThis as unknown as { process: NodeLikeProcess }).process
    proc.on('unhandledRejection', onRejection)
    const server = fakeServer()
    const real = editor.update().getMockImplementation()!
    let release!: () => void
    editor.update().mockImplementationOnce(
      (...args: unknown[]) => new Promise((resolve) => (release = () => resolve(real(...args)))),
    )
    const router = renderEditor()
    fireEvent.change(titleField(), { target: { value: 'First' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(statusText()).toContain('Saving…')
    fireEvent.change(titleField(), { target: { value: 'Second' } })
    await act(() => router.navigate('/app/campaign/c1/world'))
    await act(() => router.navigate('/app/campaign/c1/world'))
    expect(where(router)).toBe(`${editor.base}/edit`)
    await act(async () => release())
    await advance(0)
    expect(server.saved.map((s) => [s.title, s.updatedAt])).toEqual([
      ['First', 'v0'],
      ['Second', 'v1'],
    ])
    expect(where(router)).toBe('/app/campaign/c1/world')
    // The repeated navigation attempt didn't start a second save/proceed.
    await advance(0)
    proc.off('unhandledRejection', onRejection)
    const messages = [...errors.mock.calls.flat(), ...rejections].map(String).join(' | ')
    expect(messages).not.toMatch(/Invalid blocker state transition/)
    errors.mockRestore()
  })

  it('a failed save pauses leaving; Try again continues; Keep editing stays', async () => {
    const server = fakeServer()
    const real = editor.update().getMockImplementation()!
    editor.update().mockRejectedValueOnce(new ApiError('Boom', 500, null))
    const router = renderEditor()
    fireEvent.change(titleField(), { target: { value: 'Kept' } })
    await act(() => router.navigate('/app/campaign/c1/world'))
    await advance(0)
    let dialog = screen.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
    expect(statusText()).toContain('Couldn’t save')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(where(router)).toBe(`${editor.base}/edit`)
    expect(titleField()).toHaveValue('Kept')

    // Leaving again re-prompts (the save is still failed) without resending.
    await act(() => router.navigate('/app/campaign/c1/world'))
    await advance(0)
    dialog = screen.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
    editor.update().mockImplementation(real)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    await advance(0)
    expect(server.saved.map((s) => s.title)).toEqual(['Kept'])
    expect(where(router)).toBe('/app/campaign/c1/world')
  })

  it('offline: explains, keeps the local copy, and lets the user leave', async () => {
    fakeServer()
    editor.update().mockRejectedValue(new TypeError('Failed to fetch'))
    const router = renderEditor()
    setOnline(false)
    fireEvent.change(titleField(), { target: { value: 'Offline title' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(statusText()).toContain('Offline — saved on this device')
    await act(() => router.navigate('/app/campaign/c1/world'))
    await advance(0)
    const dialog = screen.getByRole('dialog', { name: 'You’re offline' })
    expect(dialog).toHaveTextContent(/won’t sync on their own/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave, keep on this device' }))
    await advance(0)
    expect(where(router)).toBe('/app/campaign/c1/world')
    expect(clearDraft).not.toHaveBeenCalled()
  })

  it('won’t offer leaving if the local copy couldn’t be stored', async () => {
    fakeServer()
    editor.update().mockRejectedValue(new ApiError('Boom', 500, null))
    vi.mocked(saveDraft).mockRejectedValue(new Error('QuotaExceededError'))
    const router = renderEditor()
    fireEvent.change(titleField(), { target: { value: 'At risk' } })
    await act(() => router.navigate('/app/campaign/c1/world'))
    await advance(0)
    expect(screen.getByText(/couldn’t store a copy/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument()
  })

  it('compares a concurrent edit and keeps mine only after confirmation', async () => {
    const server = fakeServer()
    renderEditor()
    server.otherUserSaves({ title: 'Their title' })
    fireEvent.change(titleField(), { target: { value: 'My title' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(statusText()).toContain('Changed elsewhere')
    expect(screen.getByText(new RegExp(`saved this ${editor.recordNoun} while you were editing`))).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    const dialog = screen.getByRole('dialog', { name: 'Changed elsewhere' })
    const differences = within(dialog).getByRole('list', { name: 'Differences' })
    expect(within(differences).getByText('Their title')).toBeInTheDocument()
    expect(within(differences).getByText('My title')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my changes…' }))
    expect(server.saved).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Overwrite with my version' }))
    await advance(0)
    expect(server.saved).toEqual([expect.objectContaining({ title: 'My title', updatedAt: 'v1' })])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a second concurrent update instead of overwriting it', async () => {
    const server = fakeServer()
    renderEditor()
    server.otherUserSaves({ title: 'Their title' })
    fireEvent.change(titleField(), { target: { value: 'My title' } })
    await advance(AUTOSAVE_DELAY_MS)
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Keep my changes…' }))
    server.otherUserSaves({ tags: ['siege'] })
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite with my version' }))
    await advance(0)
    expect(server.saved).toHaveLength(0)
    expect(screen.getByText(/It changed again/)).toBeInTheDocument()
  })

  it('loads the saved version after confirmation, showing it in the rich-text editor', async () => {
    const server = fakeServer()
    renderEditor()
    server.otherUserSaves({
      title: 'Their title',
      [editor.name === 'Session editor' ? 'recapContentJson' : 'publicContentJson']: doc('Their text.'),
    })
    fireEvent.change(titleField(), { target: { value: 'My title' } })
    await advance(AUTOSAVE_DELAY_MS)
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Load saved version' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard my changes' }))
    await advance(AUTOSAVE_DELAY_MS * 2)
    expect(titleField()).toHaveValue('Their title')
    expect(screen.getByLabelText(editor.richLabel)).toHaveValue('Their text.')
    expect(server.saved).toHaveLength(0)
    expect(clearDraft).toHaveBeenCalled()
  })

  it('restoring a draft shows the draft’s rich text, so it isn’t silently replaced', async () => {
    const field = editor.name === 'Session editor' ? 'recapContentJson' : 'publicContentJson'
    vi.mocked(loadDraft).mockResolvedValue({
      key: 'k',
      resourceType: editor.name === 'Session editor' ? 'session' : 'plot_thread',
      campaignId: 'c1',
      resourceId: editor.name === 'Session editor' ? 's1' : 't1',
      savedAt: new Date().toISOString(),
      data: { title: 'Draft title', [field]: doc('Draft text.') },
    })
    fakeServer()
    renderEditor()
    await advance(0)
    expect(screen.getByLabelText(editor.richLabel)).toHaveValue(editor.oldRich)
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(titleField()).toHaveValue('Draft title')
    expect(screen.getByLabelText(editor.richLabel)).toHaveValue('Draft text.')
  })

  it('gives players no editor and nothing to guard', async () => {
    fakeServer()
    const router = renderEditor('player')
    expect(screen.getByText(`You don’t have permission to edit this ${editor.recordNoun}.`)).toBeInTheDocument()
    await act(() => router.navigate('/app/campaign/c1/world'))
    expect(where(router)).toBe('/app/campaign/c1/world')
    expect(editor.update()).not.toHaveBeenCalled()
  })
})
