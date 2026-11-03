import type { CampaignDetail, CampaignRole, EntityDetail, TiptapDoc } from '@worldbinder/contracts'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { clearDraft, saveDraft } from '../../../lib/draftDb'
import * as entitiesApi from '../api/entitiesApi'
import { EntityFormPage } from './EntityFormPage'

// Real useAutosave and useLeaveGuard (React Router's blocker); only the
// network and IndexedDB are stubbed.
vi.mock('../../../lib/draftDb', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
  clearDraft: vi.fn(() => Promise.resolve()),
  loadDraft: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock('../api/entitiesApi', () => ({ updateEntity: vi.fn(), getEntity: vi.fn() }))

let entity: EntityDetail
vi.mock('../hooks/useEntities', () => ({
  useEntityQuery: () => ({ data: entity, isLoading: false, isError: false, refetch: vi.fn() }),
  useReferencedEntities: () => ({ entities: new Map(), isLoading: false }),
}))
vi.mock('../components/RichTextEditor', () => ({
  RichTextEditor: ({
    label,
    content,
    onChange,
  }: {
    label: string
    content: TiptapDoc | null
    onChange?: (doc: TiptapDoc) => void
  }) => {
    const text =
      (content?.content?.[0] as { content?: { text?: string }[] } | undefined)?.content?.[0]
        ?.text ?? ''
    return (
      <label>
        {label}
        <textarea
          defaultValue={text}
          onChange={(e) => onChange?.(doc(e.target.value))}
        />
      </label>
    )
  },
}))
vi.mock('../components/EntityPicker', () => ({
  EntityPicker: ({ label }: { label: string }) => <span>{label} picker</span>,
}))
vi.mock('../components/editor/ReferencePanel', () => ({
  ReferencePanel: ({ layout }: { layout: string }) => <aside aria-label="Reference">reference {layout}</aside>,
}))
vi.mock('../../relationships/components/ConnectionsManager', () => ({
  ConnectionsManager: () => <div>relationship manager</div>,
}))
vi.mock('../../attachments/components/AttachmentsPanel', () => ({
  AttachmentsPanel: () => <div>attachment manager</div>,
}))

const AUTOSAVE_DELAY_MS = 2000

function doc(text: string): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function makeEntity(overrides: Partial<EntityDetail> = {}): EntityDetail {
  return {
    id: 'e1',
    campaignId: 'c1',
    entityType: 'location',
    name: 'Blackwall',
    slug: 'blackwall',
    summary: 'Frontier town.',
    aliases: [],
    tags: [],
    status: 'draft',
    visibility: 'public',
    createdAt: 'v0',
    updatedAt: 'v0',
    publicContentJson: doc('Raised in 1104 AR.'),
    metadataJson: { schemaVersion: 1 },
    gmContentJson: doc('Secret tunnels.'),
    isFavorite: false,
    ...overrides,
  }
}

/** A server with the API's optimistic concurrency. `otherUserSaves`
 * simulates someone else's save landing in between. */
function fakeServer() {
  let current: EntityDetail = { ...entity, updatedAt: 'v0' }
  let version = 0
  const saved: Record<string, unknown>[] = []
  vi.mocked(entitiesApi.updateEntity).mockImplementation(async (_c, _e, input) => {
    const body = input as Record<string, unknown>
    if (body.updatedAt !== current.updatedAt) {
      throw new ApiError('Conflict', 409, { currentUpdatedAt: current.updatedAt })
    }
    version += 1
    saved.push(body)
    current = { ...current, ...(body as Partial<EntityDetail>), updatedAt: `v${version}` }
    return current
  })
  vi.mocked(entitiesApi.getEntity).mockImplementation(async () => current)
  return {
    saved,
    otherUserSaves(changes: Partial<EntityDetail>) {
      version += 1
      current = { ...current, ...changes, updatedAt: `v${version}` }
    },
  }
}

function renderEditor(role: CampaignRole = 'gm', path = '/app/campaign/c1/world/e1/edit/content') {
  const campaign = { id: 'c1', name: 'Ember', role } as CampaignDetail
  const router = createMemoryRouter(
    [
      {
        path: '/app/campaign/:campaignId',
        element: <Outlet context={{ campaign }} />,
        children: [
          { path: 'world', element: <p>World list</p> },
          { path: 'world/:entityId', element: <p>Article page</p> },
          { path: 'world/:entityId/edit/:tab', element: <EntityFormPage /> },
          { path: 'sessions', element: <p>Sessions page</p> },
        ],
      },
    ],
    { initialEntries: ['/app/campaign/c1/world', path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const where = (router: ReturnType<typeof renderEditor>) => router.state.location.pathname
const summary = () => screen.getByLabelText('Summary')
const statusText = () => (document.querySelector('.wb-save-state') as HTMLElement).textContent
const tab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Editor sections' })).getByRole('link', { name })

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  entity = makeEntity()
  vi.mocked(entitiesApi.updateEntity).mockReset()
  vi.mocked(entitiesApi.getEntity).mockReset()
  vi.mocked(saveDraft).mockReset().mockResolvedValue()
  vi.mocked(clearDraft).mockReset().mockResolvedValue()
  setOnline(true)
})

afterEach(() => {
  vi.useRealTimers()
  setOnline(true)
})

describe('Leaving the editor', () => {
  it('saves a change typed just before View article, then goes once', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'View article' }))
    fireEvent.click(screen.getByRole('button', { name: 'View article' }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(where(router)).toBe('/app/campaign/c1/world/e1')
  })

  it('saves before following another in-app link (e.g. the sidebar)', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(where(router)).toBe('/app/campaign/c1/sessions')
  })

  it('saves before browser Back', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await act(() => router.navigate(-1))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(where(router)).toBe('/app/campaign/c1/world')
  })

  it('never guards switching the editor’s own tabs', async () => {
    const server = fakeServer()
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    fireEvent.click(tab('Details'))
    fireEvent.click(tab('Files'))
    fireEvent.click(tab('Content'))
    expect(where(router)).toBe('/app/campaign/c1/world/e1/edit/content')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(server.saved).toHaveLength(0)
    expect(summary()).toHaveValue('Changed')
    await advance(AUTOSAVE_DELAY_MS)
    expect(server.saved).toHaveLength(1)
  })

  it('leaves immediately when everything is saved', async () => {
    fakeServer()
    const router = renderEditor()
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    expect(where(router)).toBe('/app/campaign/c1/sessions')
    expect(entitiesApi.updateEntity).not.toHaveBeenCalled()
  })

  it('waits for a save in flight and the edit queued behind it before leaving', async () => {
    const server = fakeServer()
    const real = vi.mocked(entitiesApi.updateEntity).getMockImplementation()!
    let release!: () => void
    vi.mocked(entitiesApi.updateEntity).mockImplementationOnce(
      (...args) => new Promise((resolve) => (release = () => resolve(real(...args)))),
    )
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'First' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(statusText()).toContain('Saving…')

    fireEvent.change(summary(), { target: { value: 'Second' } })
    // An older request finishing must not report the newer edit as saved.
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    expect(where(router)).toBe('/app/campaign/c1/world/e1/edit/content')
    await act(async () => release())
    await advance(0)
    expect(server.saved.map((s) => [s.summary, s.updatedAt])).toEqual([
      ['First', 'v0'],
      ['Second', 'v1'],
    ])
    expect(where(router)).toBe('/app/campaign/c1/sessions')
  })
})

describe('A save that fails on the way out', () => {
  it('pauses with Try again, Keep editing and Leave; Try again then continues', async () => {
    const server = fakeServer()
    const real = vi.mocked(entitiesApi.updateEntity).getMockImplementation()!
    vi.mocked(entitiesApi.updateEntity).mockRejectedValueOnce(new ApiError('Boom', 500, null))
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)

    const dialog = screen.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
    expect(where(router)).toBe('/app/campaign/c1/world/e1/edit/content')
    expect(statusText()).toContain('Couldn’t save')
    expect(within(dialog).getByRole('button', { name: 'Leave, keep on this device' })).toBeInTheDocument()

    vi.mocked(entitiesApi.updateEntity).mockImplementation(real)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(server.saved[0]).toMatchObject({ summary: 'Changed' })
    expect(where(router)).toBe('/app/campaign/c1/sessions')
  })

  it('Keep editing cancels the navigation without losing the edit', async () => {
    fakeServer()
    vi.mocked(entitiesApi.updateEntity).mockRejectedValue(new ApiError('Boom', 500, null))
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(where(router)).toBe('/app/campaign/c1/world/e1/edit/content')
    expect(summary()).toHaveValue('Changed')
  })

  it('doesn’t offer leaving when the device couldn’t store a copy', async () => {
    fakeServer()
    vi.mocked(entitiesApi.updateEntity).mockRejectedValue(new ApiError('Boom', 500, null))
    vi.mocked(saveDraft).mockRejectedValue(new Error('QuotaExceededError'))
    const router = renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)
    expect(screen.getByText(/couldn’t store a copy/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument()
  })

  it('the status Try again re-sends a failed save without any new edit', async () => {
    const server = fakeServer()
    const real = vi.mocked(entitiesApi.updateEntity).getMockImplementation()!
    vi.mocked(entitiesApi.updateEntity).mockRejectedValueOnce(new ApiError('Boom', 500, null))
    renderEditor()
    fireEvent.change(summary(), { target: { value: 'Changed' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(screen.getAllByRole('alert').some((el) => /couldn’t be saved/.test(el.textContent ?? ''))).toBe(true)
    vi.mocked(entitiesApi.updateEntity).mockImplementation(real)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(statusText()).toContain('Saved')
  })
})

describe('Offline', () => {
  it('says the change is only on this device and lets the user leave', async () => {
    fakeServer()
    vi.mocked(entitiesApi.updateEntity).mockRejectedValue(new TypeError('Failed to fetch'))
    const router = renderEditor()
    setOnline(false)
    fireEvent.change(summary(), { target: { value: 'Written offline' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(statusText()).toContain('Offline — saved on this device')
    expect(document.querySelector('.wb-save-state--saved')).toBeNull()
    expect(saveDraft).toHaveBeenLastCalledWith('entity', 'c1', 'e1', expect.objectContaining({ summary: 'Written offline' }))

    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)
    const dialog = screen.getByRole('dialog', { name: 'You’re offline' })
    expect(dialog).toHaveTextContent(/won’t sync on their own/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave, keep on this device' }))
    await advance(0)
    expect(where(router)).toBe('/app/campaign/c1/sessions')
    expect(clearDraft).not.toHaveBeenCalled()
  })
})

describe('Changed elsewhere', () => {
  async function reachConflict() {
    const server = fakeServer()
    const router = renderEditor()
    server.otherUserSaves({ name: 'Blackwall Keep', publicContentJson: doc('Rebuilt in 1290.') })
    fireEvent.change(summary(), { target: { value: 'My summary' } })
    await advance(AUTOSAVE_DELAY_MS)
    return { server, router }
  }

  it('flags the conflict and compares what keeping mine would overwrite', async () => {
    await reachConflict()
    expect(statusText()).toContain('Changed elsewhere')
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    const dialog = screen.getByRole('dialog', { name: 'Changed elsewhere' })
    const differences = within(dialog).getByRole('list', { name: 'Differences' })
    expect(within(differences).getByText('Name')).toBeInTheDocument()
    expect(within(differences).getByText('Blackwall Keep')).toBeInTheDocument()
    expect(within(differences).getByText('My summary')).toBeInTheDocument()
    const content = within(differences).getByRole('list', { name: 'Public content differences' })
    expect(within(content).getByText('Rebuilt in 1290.')).toBeInTheDocument()
    expect(within(content).getByText('Raised in 1104 AR.')).toBeInTheDocument()
  })

  it('Keep my changes needs a confirmation, then overwrites the reviewed version', async () => {
    const { server } = await reachConflict()
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Keep my changes…' }))
    expect(screen.getByText('Overwrite the saved version with yours?')).toBeInTheDocument()
    expect(server.saved).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite with my version' }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(server.saved[0]).toMatchObject({ summary: 'My summary', updatedAt: 'v1', name: 'Blackwall' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(statusText()).toContain('Saved')
    // Editing afterwards saves normally against the new version.
    fireEvent.change(summary(), { target: { value: 'After resolving' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(server.saved.at(-1)).toMatchObject({ summary: 'After resolving', updatedAt: 'v2' })
  })

  it('Load saved version needs a confirmation, then shows theirs and saves nothing', async () => {
    const { server } = await reachConflict()
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Load saved version' }))
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard my changes' }))
    await advance(AUTOSAVE_DELAY_MS * 2)
    expect(summary()).toHaveValue('Frontier town.')
    fireEvent.click(tab('Details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Blackwall Keep')
    expect(server.saved).toHaveLength(0)
    expect(clearDraft).toHaveBeenCalled()
    expect(statusText()).not.toContain('Changed elsewhere')
  })

  it('a second update during resolution is shown, not overwritten', async () => {
    const { server } = await reachConflict()
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Keep my changes…' }))
    server.otherUserSaves({ tags: ['siege'] })
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite with my version' }))
    await advance(0)
    expect(server.saved).toHaveLength(0)
    const dialog = screen.getByRole('dialog', { name: 'Changed elsewhere' })
    expect(within(dialog).getByText(/It changed again/)).toBeInTheDocument()
    expect(within(within(dialog).getByRole('list', { name: 'Differences' })).getByText('siege')).toBeInTheDocument()
  })

  it('Keep editing closes the comparison and keeps both versions', async () => {
    const { server } = await reachConflict()
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(summary()).toHaveValue('My summary')
    expect(server.saved).toHaveLength(0)
    expect(statusText()).toContain('Changed elsewhere')
  })

  it('leaving during a conflict asks for an informed choice', async () => {
    const { router } = await reachConflict()
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    await advance(0)
    const dialog = screen.getByRole('dialog', { name: 'This entry was changed elsewhere' })
    expect(dialog).toHaveTextContent(/kept on this device only; the saved version is unchanged/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review differences' }))
    await advance(0)
    expect(screen.getByRole('dialog', { name: 'Changed elsewhere' })).toBeInTheDocument()
    expect(where(router)).toBe('/app/campaign/c1/world/e1/edit/content')
  })

  it('withdraws both overwrite choices if the entry is no longer available', async () => {
    await reachConflict()
    vi.mocked(entitiesApi.getEntity).mockRejectedValue(new ApiError('Not found', 404, null))
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    expect(screen.getByText(/no longer available to you/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep my changes…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load saved version' })).not.toBeInTheDocument()
  })

  it('doesn’t compare GM-only content for an editor without GM access', async () => {
    const { gmContentJson: _gm, ...noGm } = makeEntity()
    void _gm
    entity = noGm as EntityDetail
    const server = fakeServer()
    renderEditor('editor')
    server.otherUserSaves({ name: 'Renamed' })
    fireEvent.change(summary(), { target: { value: 'Mine' } })
    await advance(AUTOSAVE_DELAY_MS)
    fireEvent.click(screen.getAllByRole('button', { name: 'Review differences' })[0]!)
    await advance(0)
    expect(screen.queryByText('GM-only content')).not.toBeInTheDocument()
  })
})

describe('Access', () => {
  it('players get no editor and nothing to guard', async () => {
    fakeServer()
    const router = renderEditor('player')
    expect(screen.getByText('You don’t have permission to edit this entry.')).toBeInTheDocument()
    await act(() => router.navigate('/app/campaign/c1/sessions'))
    expect(where(router)).toBe('/app/campaign/c1/sessions')
  })
})
