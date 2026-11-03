import type {
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  EntityRelationshipView,
  EntitySummary,
  TiptapDoc,
} from '@worldbinder/contracts'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { EntityDetailPage } from './EntityDetailPage'

// --- Data: each test sets what the API "returned". --------------------------

let entityResult: { data?: EntityDetail; isLoading?: boolean; isError?: boolean; error?: Error }
let referenced: Map<string, EntityDetail | null>
let relationships: EntityRelationshipView[]
let backlinks: { sourceEntity: EntitySummary; section: 'public' | 'gm' }[]
let threads: { id: string; title: string; importance?: string }[]
let sessions: { id: string; sessionNumber: number; title: string }[]
const toggleFavorite = vi.fn()
const deleteEntity = vi.fn()

vi.mock('../hooks/useEntities', () => ({
  useEntityQuery: () => ({ isLoading: false, isError: false, refetch: vi.fn(), ...entityResult }),
  useReferencedEntities: () => ({ entities: referenced, isLoading: false }),
  useDeleteEntityMutation: () => ({ mutate: deleteEntity, isPending: false }),
  useToggleFavoriteMutation: () => ({ mutate: toggleFavorite, isPending: false }),
  useEntityPlotThreadsQuery: () => ({ data: threads, isSuccess: true, isLoading: false, isError: false }),
  useEntitySessionsQuery: () => ({ data: sessions, isSuccess: true, isLoading: false, isError: false }),
}))
vi.mock('../../relationships/hooks/useRelationships', () => ({
  useEntityRelationshipsQuery: () => ({ data: relationships, isLoading: false, isError: false }),
  useEntityBacklinksQuery: () => ({ data: backlinks, isLoading: false, isError: false }),
}))
vi.mock('../../attachments/hooks/useAttachments', () => ({
  useAttachmentsForResourceQuery: () => ({ data: [{ id: 'a1' }, { id: 'a2' }] }),
}))
// Self-contained panels with their own tests/e2e coverage — here only
// where they're mounted (and with which permissions) matters.
vi.mock('../../attachments/components/AttachmentsPanel', () => ({
  AttachmentsPanel: ({ canManage }: { canManage: boolean }) => (
    <div data-testid="attachments">attachments canManage={String(canManage)}</div>
  ),
}))
vi.mock('../../revisions/components/RevisionHistoryPanel', () => ({
  RevisionHistoryPanel: ({ canRestore }: { canRestore: boolean }) => (
    <div data-testid="revisions">revisions canRestore={String(canRestore)}</div>
  ),
}))
// TipTap doesn't lay out in jsdom; render the document's text and mention
// labels as links so content and mentions are still checked.
vi.mock('../components/RichTextEditor', () => ({
  RichTextEditor: ({ content }: { content: TiptapDoc | null }) => {
    const nodes = (content?.content ?? []) as { content?: { type: string; text?: string; attrs?: { label: string } }[] }[]
    return (
      <div data-testid="prose">
        {nodes.map((block, i) => (
          <p key={i}>
            {(block.content ?? []).map((inline, j) =>
              inline.type === 'entityMention' ? (
                <a key={j} href={`/mention/${inline.attrs?.label}`}>
                  {inline.attrs?.label}
                </a>
              ) : (
                <span key={j}>{inline.text}</span>
              ),
            )}
          </p>
        ))}
      </div>
    )
  },
}))

// --- Fixtures ---------------------------------------------------------------

const STAMP = new Date(Date.now() - 4 * 86_400_000).toISOString()

const para = (text: string): TiptapDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function makeEntity(overrides: Partial<EntityDetail> = {}): EntityDetail {
  return {
    id: 'e1',
    campaignId: 'c1',
    entityType: 'location',
    name: 'Blackwall',
    slug: 'blackwall',
    summary: 'Frontier town on the Northern Wall.',
    aliases: ['the Wallgate'],
    tags: ['frontier', 'trade-hub'],
    status: 'published',
    visibility: 'public',
    createdAt: STAMP,
    updatedAt: STAMP,
    publicContentJson: para('Raised in 1104 AR as a supply post.'),
    metadataJson: {
      schemaVersion: 1,
      locationType: 'Frontier town',
      population: 2400,
      government: 'Ducal holding',
      parentLocationEntityId: 'p1',
    },
    gmContentJson: para('The tunnels run beneath the wall.'),
    isFavorite: false,
    ...overrides,
  }
}

function summary(id: string, name: string, extra: Partial<EntitySummary> = {}): EntitySummary {
  return { ...makeEntity({ id, name, ...extra }) }
}

function relationship(id: string, label: string, name: string, extra: Partial<EntityRelationshipView> = {}): EntityRelationshipView {
  return {
    relationshipId: id,
    relationshipTypeId: `type-${label}`,
    direction: 'outgoing',
    label,
    otherEntity: summary(`o-${id}`, name),
    description: null,
    visibility: 'public',
    ...extra,
  }
}

function makeCampaign(role: CampaignRole): CampaignDetail {
  return {
    id: 'c1',
    name: 'The Ember Coast',
    slug: 'ember',
    description: null,
    systemName: null,
    status: 'active',
    role,
    coverImageUrl: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    archivedAt: null,
    settingsJson: null,
    currentWorldDateJson: null,
    calendarConfigJson: null,
    dashboardBackdropJson: null,
  }
}

function renderPage(role: CampaignRole = 'gm') {
  const campaign = makeCampaign(role)
  const router = createMemoryRouter(
    [
      {
        path: '/app/campaign/:campaignId',
        element: <Outlet context={{ campaign }} />,
        children: [
          { path: 'world/:entityId', element: <EntityDetailPage /> },
          { path: 'world', element: <p>World list</p> },
        ],
      },
    ],
    { initialEntries: ['/app/campaign/c1/world/e1'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const region = (name: string | RegExp) => screen.getByRole('region', { name })
const aside = () => screen.getByRole('complementary', { name: /^Connected to/ })

function stubPhone(isPhone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: isPhone, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  )
}

beforeEach(() => {
  entityResult = { data: makeEntity() }
  referenced = new Map([['p1', makeEntity({ id: 'p1', name: 'Northern March' })]])
  relationships = []
  backlinks = []
  threads = []
  sessions = []
  toggleFavorite.mockReset()
  deleteEntity.mockReset()
  stubPhone(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// --- Tests ------------------------------------------------------------------

describe('Entity article — header', () => {
  it('has one h1, breadcrumbs, type, aliases and tags', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Blackwall' })).toBeInTheDocument()
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'World' })).toHaveAttribute('href', '/app/campaign/c1/world')
    expect(within(crumbs).getByRole('link', { name: 'Locations' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world?type=location',
    )
    expect(within(crumbs).getByText('Blackwall')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('the Wallgate')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('offers Edit, favorite and delete to editors', () => {
    renderPage('editor')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/app/campaign/c1/world/e1/edit/content')
    const star = screen.getByRole('button', { name: 'Add to favorites' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(star)
    expect(toggleFavorite).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(deleteEntity).toHaveBeenCalledWith('e1', expect.anything())
  })

  it('gives players favorite and copy link, but no Edit or Delete', () => {
    renderPage('player')
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Copy link'])
  })

  it('flags an entry with GM-only notes', () => {
    renderPage()
    expect(screen.getByText('Has GM-only notes')).toBeInTheDocument()
  })

  it('flags an entry that is itself GM-only', () => {
    entityResult = { data: makeEntity({ visibility: 'gm_only' }) }
    renderPage()
    expect(screen.getByText('GM only')).toBeInTheDocument()
  })
})

describe('Entity article — content', () => {
  it('leads with the summary, then facts, text and GM-only notes', () => {
    renderPage('gm')
    expect(screen.getByText('Frontier town on the Northern Wall.')).toHaveClass('wb-ed-lede')
    expect(screen.getByLabelText('Key facts')).toBeInTheDocument()
    expect(screen.getByText('Raised in 1104 AR as a supply post.')).toBeInTheDocument()
    const gm = region('GM-only notes')
    expect(within(gm).getByText('Hidden from players')).toBeInTheDocument()
    expect(within(gm).getByText('The tunnels run beneath the wall.')).toBeInTheDocument()
  })

  it('never shows GM notes to a member the API withholds them from', () => {
    const { gmContentJson: _omitted, ...withoutGm } = makeEntity()
    void _omitted
    entityResult = { data: withoutGm as EntityDetail }
    renderPage('player')
    expect(screen.queryByRole('region', { name: 'GM-only notes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Has GM-only notes')).not.toBeInTheDocument()
  })

  it('handles a short entry with nothing written', () => {
    entityResult = { data: makeEntity({ summary: null, publicContentJson: null, gmContentJson: null, metadataJson: null }) }
    referenced = new Map()
    renderPage('editor')
    expect(screen.getByText(/Nothing has been written about Blackwall yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start writing' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/e1/edit/content',
    )
    expect(screen.queryByRole('region', { name: 'GM-only notes' })).not.toBeInTheDocument()
  })

  it('keeps a long article’s mentions as links', () => {
    entityResult = {
      data: makeEntity({
        publicContentJson: {
          type: 'doc',
          content: Array.from({ length: 40 }, (_, i) => ({
            type: 'paragraph',
            content: [
              { type: 'text', text: `Paragraph ${i} about ` },
              { type: 'entityMention', attrs: { entityId: 'm1', label: 'Ashen Guard' } },
            ],
          })),
        },
      }),
    }
    renderPage()
    expect(screen.getAllByRole('link', { name: 'Ashen Guard' })).toHaveLength(40)
  })
})

describe('Entity article — facts strip', () => {
  it('shows a location’s facts and links its parent location', () => {
    renderPage()
    const strip = screen.getByLabelText('Key facts')
    expect(within(strip).getByText('Location type')).toBeInTheDocument()
    expect(within(strip).getByText((2400).toLocaleString())).toBeInTheDocument()
    expect(within(strip).getByRole('link', { name: 'Northern March' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/p1',
    )
  })

  it('shows a character’s facts and current location', () => {
    entityResult = {
      data: makeEntity({
        entityType: 'character',
        name: 'Captain Mara Voss',
        metadataJson: { pronouns: 'she/her', occupation: 'Garrison captain', currentLocationEntityId: 'p1' },
      }),
    }
    renderPage()
    const strip = screen.getByLabelText('Key facts')
    expect(within(strip).getByText('she/her')).toBeInTheDocument()
    expect(within(strip).getByText('Current location')).toBeInTheDocument()
    expect(within(strip).queryByText('Species')).not.toBeInTheDocument()
  })

  it('shows a faction’s leader and headquarters', () => {
    entityResult = {
      data: makeEntity({
        entityType: 'faction',
        name: 'Ashen Guard',
        metadataJson: { factionType: 'Military order', leaderEntityId: 'l1', headquartersLocationEntityId: 'h1' },
      }),
    }
    referenced = new Map([
      ['l1', makeEntity({ id: 'l1', name: 'Captain Mara Voss' })],
      ['h1', makeEntity({ id: 'h1', name: 'Blackwall Keep' })],
    ])
    renderPage()
    const strip = screen.getByLabelText('Key facts')
    expect(within(strip).getByRole('link', { name: 'Captain Mara Voss' })).toBeInTheDocument()
    expect(within(strip).getByRole('link', { name: 'Blackwall Keep' })).toBeInTheDocument()
  })

  it('renders no strip when there are no facts', () => {
    entityResult = { data: makeEntity({ metadataJson: { schemaVersion: 1 } }) }
    renderPage()
    expect(screen.queryByLabelText('Key facts')).not.toBeInTheDocument()
  })
})

describe('Entity article — connections', () => {
  it('shows metadata-derived connections separately from relationships', () => {
    relationships = [relationship('r1', 'Controlled by', 'Duke Renald')]
    renderPage()
    const connections = region(/^Connections/)
    const derived = within(connections).getByRole('list', { name: 'Connections from details' })
    expect(within(derived).getByText('Located in')).toBeInTheDocument()
    expect(within(derived).getByRole('link', { name: 'Northern March' })).toBeInTheDocument()
    const explicit = within(connections).getByRole('list', { name: 'Relationships' })
    expect(within(explicit).getByText('Controlled by')).toBeInTheDocument()
    expect(within(explicit).queryByRole('link', { name: 'Northern March' })).not.toBeInTheDocument()
  })

  it('omits references the member cannot see — no name, no placeholder', () => {
    referenced = new Map([['p1', null]])
    renderPage('player')
    expect(screen.queryByRole('list', { name: 'Connections from details' })).not.toBeInTheDocument()
    expect(screen.queryByText('Parent location')).not.toBeInTheDocument()
    expect(screen.queryByText('p1')).not.toBeInTheDocument()
  })

  it('collapses many relationships behind an accessible "Show more"', () => {
    relationships = Array.from({ length: 11 }, (_, i) =>
      relationship(`r${i}`, 'Ally of', `Ally ${i}`, i === 3 ? { visibility: 'gm_only' } : {}),
    )
    renderPage()
    const list = screen.getByRole('list', { name: 'Relationships' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getByText('GM only')).toBeInTheDocument()
    const more = screen.getByRole('button', { name: 'Show 5 more' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveAttribute('aria-controls', list.id)
    fireEvent.click(more)
    expect(within(list).getAllByRole('listitem')).toHaveLength(11)
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('lists backlinks as "Mentioned in", flagging GM-note mentions', () => {
    backlinks = Array.from({ length: 8 }, (_, i) => ({
      sourceEntity: summary(`b${i}`, `Source ${i}`),
      section: i === 0 ? 'gm' : 'public',
    }))
    renderPage()
    const mentions = screen.getByRole('list', { name: 'Mentioned in' })
    expect(within(mentions).getAllByRole('link')).toHaveLength(6)
    expect(within(mentions).getByText('· GM notes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(within(mentions).getAllByRole('link')).toHaveLength(8)
  })

  it('links editors to the Connections tab to manage relationships', () => {
    renderPage('editor')
    expect(screen.getByRole('link', { name: 'Manage connections' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/world\/[^/]+\/edit\/connections$/),
    )
  })

  it('has no Manage control for players', () => {
    renderPage('player')
    expect(screen.queryByRole('link', { name: 'Manage connections' })).not.toBeInTheDocument()
  })

  it('says so when there are no connections', () => {
    referenced = new Map()
    entityResult = { data: makeEntity({ metadataJson: null }) }
    renderPage()
    expect(within(region(/^Connections/)).getByText('No connections yet.')).toBeInTheDocument()
  })
})

describe('Entity article — threads, sessions, files and history', () => {
  it('lists plot threads and session appearances', () => {
    threads = [{ id: 't1', title: 'The Missing Caravan', importance: 'major' }]
    sessions = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, sessionNumber: 7 - i, title: `Session title ${i}` }))
    renderPage()
    expect(within(region(/^Plot threads/)).getByRole('link', { name: 'The Missing Caravan' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/threads/t1',
    )
    expect(within(region(/^Plot threads/)).getByText('Major')).toBeInTheDocument()
    const appearances = screen.getByRole('list', { name: 'Session appearances' })
    expect(within(appearances).getAllByRole('link')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Show 2 more' })).toBeInTheDocument()
  })

  it('shows empty states for threads and sessions', () => {
    renderPage()
    expect(screen.getByText('Not part of any plot thread yet.')).toBeInTheDocument()
    expect(screen.getByText('No session appearances yet.')).toBeInTheDocument()
  })

  it('keeps files and revision history behind disclosures, with existing permissions', () => {
    renderPage('editor')
    const files = within(aside()).getByText('Files').closest('details')!
    expect(within(files).getByText('2')).toBeInTheDocument()
    expect(screen.queryByTestId('attachments')).not.toBeInTheDocument()
    fireEvent.click(within(files).getByText('Files'))
    files.open = true
    fireEvent(files, new Event('toggle'))
    expect(screen.getByTestId('attachments')).toHaveTextContent('canManage=true')

    const history = within(aside()).getByText('Revision history').closest('details')!
    expect(within(history).getByText('edited 4d ago')).toBeInTheDocument()
    history.open = true
    fireEvent(history, new Event('toggle'))
    expect(screen.getByTestId('revisions')).toHaveTextContent('canRestore=true')
  })

  it('does not let players restore revisions or manage files', () => {
    renderPage('player')
    const files = within(aside()).getByText('Files').closest('details')!
    files.open = true
    fireEvent(files, new Event('toggle'))
    expect(screen.getByTestId('attachments')).toHaveTextContent('canManage=false')
    const history = within(aside()).getByText('Revision history').closest('details')!
    history.open = true
    fireEvent(history, new Event('toggle'))
    expect(screen.getByTestId('revisions')).toHaveTextContent('canRestore=false')
  })
})

describe('Entity article — phone layout', () => {
  beforeEach(() => stubPhone(true))

  it('puts summary and facts first, then a compact connections preview, then the article', () => {
    relationships = Array.from({ length: 11 }, (_, i) => relationship(`r${i}`, 'Ally of', `Ally ${i}`))
    backlinks = [{ sourceEntity: summary('b1', 'Source 1'), section: 'public' }]
    renderPage()
    const article = screen.getByRole('article', { name: 'Blackwall' })
    const facts = within(article).getByLabelText('Key facts')
    const connections = within(article).getByRole('region', { name: /^Connections/ })
    const prose = within(article).getAllByTestId('prose')[0]!
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(facts, connections)).toBe(true)
    expect(follows(connections, prose)).toBe(true)

    // Only a short preview at first: three of the twelve connections.
    const preview = within(connections).getByRole('list', { name: 'Connection preview' })
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3)
    expect(within(connections).queryByRole('list', { name: 'Relationships' })).not.toBeInTheDocument()
    expect(within(connections).queryByRole('list', { name: 'Mentioned in' })).not.toBeInTheDocument()

    const expand = within(connections).getByRole('button', { name: 'Show all connections and mentions' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expand)
    expect(within(connections).queryByRole('list', { name: 'Connection preview' })).not.toBeInTheDocument()
    expect(within(connections).getByRole('list', { name: 'Relationships' })).toBeVisible()
    expect(within(connections).getByRole('list', { name: 'Mentioned in' })).toBeVisible()
    expect(within(connections).getByRole('button', { name: 'Show fewer connections' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('collapses the other panels into disclosures', () => {
    renderPage()
    for (const title of ['Plot threads', 'Appears in', 'Files', 'Revision history']) {
      expect(within(aside()).getByText(title).closest('details')).not.toBeNull()
    }
  })

  it('needs no expand control when everything fits in the preview', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /Show all connections/ })).not.toBeInTheDocument()
  })
})

describe('Entity article — duplicate connections', () => {
  it('lists a relationship that restates a detail once, keeping its description', () => {
    relationships = [
      relationship('r1', 'Located in', 'Northern March', {
        otherEntity: summary('p1', 'Northern March'),
        description: 'Since the treaty of 1102.',
      }),
      relationship('r2', 'Controlled by', 'Duke Renald'),
    ]
    renderPage()
    const connections = region(/^Connections/)
    expect(within(connections).getAllByRole('link', { name: 'Northern March' })).toHaveLength(1)
    const derived = within(connections).getByRole('list', { name: 'Connections from details' })
    expect(within(derived).getByText(/Also recorded as a relationship: Since the treaty of 1102\./)).toBeInTheDocument()
    expect(within(connections).getByRole('list', { name: 'Relationships' })).not.toHaveTextContent('Northern March')
    expect(within(connections).getByRole('heading', { name: /Connections\s*2/ })).toBeInTheDocument()
  })

  it('keeps a GM-only relationship listed separately with its badge', () => {
    relationships = [
      relationship('r1', 'Located in', 'Northern March', {
        otherEntity: summary('p1', 'Northern March'),
        visibility: 'gm_only',
      }),
    ]
    renderPage()
    const connections = region(/^Connections/)
    expect(within(connections).getAllByRole('link', { name: 'Northern March' })).toHaveLength(2)
    expect(within(within(connections).getByRole('list', { name: 'Relationships' })).getByText('GM only')).toBeInTheDocument()
  })
})

describe('Entity article — loading and errors', () => {
  it('shows a loading state', () => {
    entityResult = { isLoading: true }
    renderPage()
    expect(screen.getByText('Loading entry…')).toBeInTheDocument()
  })

  it('treats 404 as not found or not shared, without confirming it exists', () => {
    entityResult = { isError: true, error: new ApiError('Not found', 404, null) }
    renderPage('player')
    expect(screen.getByText(/could not be found/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to World' })).toHaveAttribute('href', '/app/campaign/c1/world')
  })

  it('shows other errors with a retry', () => {
    entityResult = { isError: true, error: new ApiError('Server exploded', 500, null) }
    renderPage()
    expect(screen.getByText('Server exploded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
