import type { CampaignDetail, CampaignRole, EntityDetail, TiptapDoc } from '@worldbinder/contracts'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { loadDraft, type ResourceDraft } from '../../../lib/draftDb'
import * as entitiesApi from '../api/entitiesApi'
import { EntityEditRedirect, EntityFormPage } from './EntityFormPage'

// Real useAutosave; only the network and IndexedDB are stubbed.
vi.mock('../../../lib/draftDb', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
  clearDraft: vi.fn(() => Promise.resolve()),
  loadDraft: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock('../api/entitiesApi', () => ({ updateEntity: vi.fn() }))

let entity: EntityDetail
vi.mock('../hooks/useEntities', () => ({
  useEntityQuery: () => ({ data: entity, isLoading: false, isError: false, refetch: vi.fn() }),
}))

// TipTap doesn't run in jsdom: a textarea stand-in that reports edits as a
// one-paragraph doc and counts its mounts (a remount would reset TipTap).
const editorMounts: Record<string, number> = {}
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
    useEffect(() => {
      editorMounts[label] = (editorMounts[label] ?? 0) + 1
    }, [label])
    const text =
      ((content?.content?.[0] as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text) ?? ''
    return (
      <label>
        {label}
        <textarea
          defaultValue={text}
          onChange={(e) =>
            onChange?.({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: e.target.value }] }],
            })
          }
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
  ConnectionsManager: ({ canEdit }: { canEdit: boolean }) => <div>relationship manager canEdit={String(canEdit)}</div>,
}))
vi.mock('../../attachments/components/AttachmentsPanel', () => ({
  AttachmentsPanel: ({ canManage }: { canManage: boolean }) => <div>attachment manager canManage={String(canManage)}</div>,
}))

const AUTOSAVE_DELAY_MS = 2000

/** Fake server with the API's optimistic concurrency (409 on a stale
 * `updatedAt`). */
function fakeServer() {
  let version = 0
  const saved: Record<string, unknown>[] = []
  vi.mocked(entitiesApi.updateEntity).mockImplementation(async (_c, _e, input) => {
    const body = input as Record<string, unknown>
    if (body.updatedAt !== `v${version}`) {
      throw new ApiError('Conflict', 409, { currentUpdatedAt: `v${version}` })
    }
    version += 1
    saved.push(body)
    return { ...entity, updatedAt: `v${version}` } as EntityDetail
  })
  return { saved }
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
    tags: ['frontier'],
    status: 'draft',
    visibility: 'public',
    createdAt: 'v0',
    updatedAt: 'v0',
    publicContentJson: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Raised in 1104 AR.' }] }],
    },
    metadataJson: { schemaVersion: 1, population: 2400 },
    gmContentJson: null,
    isFavorite: false,
    ...overrides,
  }
}

function campaign(role: CampaignRole): CampaignDetail {
  return { id: 'c1', name: 'Ember', role } as CampaignDetail
}

function renderEditor(path: string, role: CampaignRole = 'gm') {
  const router = createMemoryRouter(
    [
      {
        path: '/app/campaign/:campaignId',
        element: <Outlet context={{ campaign: campaign(role) }} />,
        children: [
          { path: 'world/:entityId', element: <p>Article page</p> },
          { path: 'world/:entityId/edit', element: <EntityEditRedirect /> },
          { path: 'world/:entityId/edit/:tab', element: <EntityFormPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const tabs = () => screen.getByRole('navigation', { name: 'Editor sections' })
const tab = (name: string) => within(tabs()).getByRole('link', { name })
const saveStatus = () => document.querySelector('.wb-save-state') as HTMLElement
const panel = (name: string) => document.querySelector(`section[aria-label="${name}"]`) as HTMLElement

beforeEach(() => {
  vi.useFakeTimers()
  entity = makeEntity()
  for (const key of Object.keys(editorMounts)) delete editorMounts[key]
  vi.mocked(entitiesApi.updateEntity).mockReset()
  vi.mocked(loadDraft).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Entity editor — routes and tabs', () => {
  it('sends the old /edit URL to the Content tab', async () => {
    const router = renderEditor('/app/campaign/c1/world/e1/edit')
    await advance(0)
    expect(router.state.location.pathname).toBe('/app/campaign/c1/world/e1/edit/content')
    expect(tab('Content')).toHaveAttribute('aria-current', 'page')
    expect(panel('Content')).toBeVisible()
    expect(panel('Details')).not.toBeVisible()
  })

  it('resolves an unknown tab to Content', async () => {
    const router = renderEditor('/app/campaign/c1/world/e1/edit/nonsense')
    await advance(0)
    expect(router.state.location.pathname).toBe('/app/campaign/c1/world/e1/edit/content')
  })

  it('opens a tab directly from its URL', () => {
    renderEditor('/app/campaign/c1/world/e1/edit/details')
    expect(tab('Details')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Name')).toBeVisible()
  })

  it('supports Back and Forward between tabs', async () => {
    const router = renderEditor('/app/campaign/c1/world/e1/edit/content')
    fireEvent.click(tab('Details'))
    expect(tab('Details')).toHaveAttribute('aria-current', 'page')
    await act(() => router.navigate(-1))
    expect(tab('Content')).toHaveAttribute('aria-current', 'page')
    await act(() => router.navigate(1))
    expect(tab('Details')).toHaveAttribute('aria-current', 'page')
  })

  it('shows breadcrumbs back to the article, and the entity’s name and type', () => {
    renderEditor('/app/campaign/c1/world/e1/edit/content')
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'Blackwall' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/e1',
    )
    expect(within(crumbs).getByText('Edit')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Editing Blackwall')
  })
})

describe('Entity editor — state survives tab switches', () => {
  it('keeps a pending change, doesn’t remount the editor, and saves once', async () => {
    const server = fakeServer()
    renderEditor('/app/campaign/c1/world/e1/edit/details')
    await advance(0)
    const mountsBefore = editorMounts['Public content']

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Blackwall Keep' } })
    expect(saveStatus()).toHaveTextContent('Waiting to save…')
    fireEvent.click(tab('Content'))
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'A walled town.' } })
    fireEvent.click(tab('Details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Blackwall Keep')
    fireEvent.click(tab('Content'))
    expect(screen.getByLabelText('Summary')).toHaveValue('A walled town.')

    expect(entitiesApi.updateEntity).not.toHaveBeenCalled()
    await advance(AUTOSAVE_DELAY_MS)
    expect(server.saved).toHaveLength(1)
    expect(server.saved[0]).toMatchObject({ name: 'Blackwall Keep', summary: 'A walled town.', updatedAt: 'v0' })
    expect(editorMounts['Public content']).toBe(mountsBefore)
    expect(saveStatus()).toHaveTextContent('Saved')
  })

  it('switching tabs alone never saves', async () => {
    fakeServer()
    renderEditor('/app/campaign/c1/world/e1/edit/content')
    for (const name of ['Details', 'Connections', 'Files', 'Content']) fireEvent.click(tab(name))
    await advance(AUTOSAVE_DELAY_MS * 2)
    expect(entitiesApi.updateEntity).not.toHaveBeenCalled()
  })

  it('an edit made during an in-flight save is sent next, with the new version', async () => {
    let release!: () => void
    const server = fakeServer()
    const real = vi.mocked(entitiesApi.updateEntity).getMockImplementation()!
    vi.mocked(entitiesApi.updateEntity).mockImplementationOnce(
      (...args) => new Promise((resolve) => (release = () => resolve(real(...args)))),
    )
    renderEditor('/app/campaign/c1/world/e1/edit/content')
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'First' } })
    await advance(AUTOSAVE_DELAY_MS)
    expect(entitiesApi.updateEntity).toHaveBeenCalledTimes(1)

    fireEvent.click(tab('Details'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Second' } })
    await advance(AUTOSAVE_DELAY_MS)
    await act(async () => release())
    await advance(0)

    expect(server.saved.map((s) => [s.summary, s.name, s.updatedAt])).toEqual([
      ['First', 'Blackwall', 'v0'],
      ['First', 'Second', 'v1'],
    ])
    expect(screen.queryByText('Changed elsewhere')).not.toBeInTheDocument()
  })
})

describe('Entity editor — View article', () => {
  it('saves a pending change before returning to the article', async () => {
    const server = fakeServer()
    const router = renderEditor('/app/campaign/c1/world/e1/edit/content')
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'View article' }))
    await advance(0)
    expect(server.saved).toHaveLength(1)
    expect(router.state.location.pathname).toBe('/app/campaign/c1/world/e1')
  })

})

describe('Entity editor — drafts', () => {
  it('offers a saved local draft back and restores it into the fields', async () => {
    const draft: ResourceDraft = {
      key: 'entity:c1:e1',
      resourceType: 'entity',
      campaignId: 'c1',
      resourceId: 'e1',
      savedAt: new Date().toISOString(),
      data: { name: 'Draft name', summary: 'Draft summary' },
    }
    vi.mocked(loadDraft).mockResolvedValue(draft)
    renderEditor('/app/campaign/c1/world/e1/edit/content')
    await advance(0)
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(screen.getByLabelText('Summary')).toHaveValue('Draft summary')
    fireEvent.click(tab('Details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Draft name')
  })
})

describe('Entity editor — Details per type', () => {
  it.each([
    ['location', ['Location type', 'Population', 'Government', 'Parent location picker'], 'Location details'],
    ['character', ['Pronouns', 'Species', 'Occupation', 'Life status', 'Current location picker'], 'Character details'],
    ['faction', ['Faction type', 'Leader picker', 'Headquarters picker'], 'Faction details'],
  ] as const)('shows a %s’s own fields only', (entityType, fields, legend) => {
    entity = makeEntity({ entityType, metadataJson: { schemaVersion: 1 } })
    renderEditor('/app/campaign/c1/world/e1/edit/details')
    const group = screen.getByRole('group', { name: legend })
    for (const field of fields) expect(within(group).getByText(field)).toBeInTheDocument()
    // No fields from other types.
    if (entityType !== 'location') expect(within(group).queryByText('Population')).toBeNull()
    if (entityType !== 'character') expect(within(group).queryByText('Species')).toBeNull()
    expect(screen.getByLabelText('Type')).toBeDisabled()
    for (const label of ['Name', 'Aliases', 'Tags', 'Visibility', 'Status']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })
})

describe('Entity editor — permissions', () => {
  it('shows the GM-only editor only when the API sent GM content', () => {
    renderEditor('/app/campaign/c1/world/e1/edit/content')
    expect(screen.getByLabelText('GM-only content')).toBeInTheDocument()
  })

  it('hides it from an editor without GM access', () => {
    const { gmContentJson: _gm, ...rest } = makeEntity()
    void _gm
    entity = rest as EntityDetail
    renderEditor('/app/campaign/c1/world/e1/edit/content', 'editor')
    expect(screen.queryByLabelText('GM-only content')).not.toBeInTheDocument()
  })

  it('gives players no editor, and saves nothing', async () => {
    fakeServer()
    renderEditor('/app/campaign/c1/world/e1/edit/details', 'player')
    expect(screen.getByText('You don’t have permission to edit this entry.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Editor sections' })).not.toBeInTheDocument()
    await advance(AUTOSAVE_DELAY_MS)
    expect(entitiesApi.updateEntity).not.toHaveBeenCalled()
  })
})

describe('Entity editor — Connections and Files tabs', () => {
  it('hosts the existing relationship manager', () => {
    renderEditor('/app/campaign/c1/world/e1/edit/connections', 'editor')
    expect(screen.getByText('relationship manager canEdit=true')).toBeInTheDocument()
  })

  it('hosts the existing attachment manager', () => {
    renderEditor('/app/campaign/c1/world/e1/edit/files', 'editor')
    expect(screen.getByText('attachment manager canManage=true')).toBeInTheDocument()
  })
})
