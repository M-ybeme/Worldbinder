import type {
  CampaignRole,
  EntityDetail,
  EntityRelationship,
  EntityRelationshipView,
  EntityType,
  RelationshipType,
} from '@worldbinder/contracts'
import type { CreateRelationshipInput } from '@worldbinder/validation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { ConnectionsManager } from './ConnectionsManager'

// --- A small in-memory relationships API with the server's rules. ---------

function makeEntity(id: string, name: string, entityType: EntityType, metadataJson: Record<string, unknown> | null = null): EntityDetail {
  return {
    id,
    campaignId: 'c1',
    entityType,
    name,
    slug: id,
    summary: null,
    aliases: [],
    tags: [],
    status: 'active',
    visibility: 'public',
    createdAt: '',
    updatedAt: '',
    publicContentJson: null,
    metadataJson,
    isFavorite: false,
  } as unknown as EntityDetail
}

const TYPES: RelationshipType[] = [
  { id: 'ally', key: 'ally_of', forwardLabel: 'Ally of', reverseLabel: 'Ally of', symmetric: true },
  { id: 'located', key: 'located_in', forwardLabel: 'Located in', reverseLabel: 'Contains', symmetric: false, allowedTargetTypes: ['location'] },
  { id: 'controls', key: 'controls', forwardLabel: 'Controls', reverseLabel: 'Controlled by', symmetric: false, allowedTargetTypes: ['location', 'faction', 'organization'] },
].map(
  (type) =>
    ({
      campaignId: null,
      allowedSourceTypes: null,
      allowedTargetTypes: null,
      allowDuplicates: false,
      defaultVisibility: 'public',
      ...type,
    }) as RelationshipType,
)

let entities: Map<string, EntityDetail>
let stored: (EntityRelationship & { seq: number })[]
let seq = 0
let failCreate: ApiError | null = null
let failDelete: ApiError | null = null
const created: CreateRelationshipInput[] = []

vi.mock('../api/relationshipsApi', () => ({
  listRelationshipTypes: () => Promise.resolve(TYPES),
  getEntityBacklinks: () => Promise.resolve([]),
  getEntityRelationships: (_c: string, entityId: string): Promise<EntityRelationshipView[]> =>
    Promise.resolve(
      stored.flatMap((row) => {
        const type = TYPES.find((t) => t.id === row.relationshipTypeId)!
        if (row.sourceEntityId === entityId || row.targetEntityId === entityId) {
          const outgoing = row.sourceEntityId === entityId
          return [
            {
              relationshipId: row.id,
              relationshipTypeId: row.relationshipTypeId,
              direction: outgoing ? 'outgoing' : 'incoming',
              label: outgoing ? type.forwardLabel : type.reverseLabel,
              otherEntity: entities.get(outgoing ? row.targetEntityId : row.sourceEntityId)!,
              description: row.description,
              visibility: row.visibility,
            } as EntityRelationshipView,
          ]
        }
        return []
      }),
    ),
  createRelationship: (_c: string, input: CreateRelationshipInput) => {
    created.push(input)
    if (failCreate) return Promise.reject(failCreate)
    const row = {
      id: `r${++seq}`,
      seq,
      campaignId: 'c1',
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      relationshipTypeId: input.relationshipTypeId,
      description: input.description ?? null,
      visibility: input.visibility ?? 'public',
      createdAt: '',
      updatedAt: '',
    }
    stored.push(row)
    return Promise.resolve(row)
  },
  deleteRelationship: (_c: string, id: string) => {
    if (failDelete) return Promise.reject(failDelete)
    stored = stored.filter((row) => row.id !== id)
    return Promise.resolve({ message: 'ok' })
  },
}))

vi.mock('../../entities/api/entitiesApi', () => ({
  getEntity: (_c: string, id: string) => {
    const entity = entities.get(id)
    return entity ? Promise.resolve(entity) : Promise.reject(new ApiError('Not found', 404))
  },
}))

// The real picker searches the API; here it's a plain select of entries.
vi.mock('../../entities/components/EntityPicker', () => ({
  EntityPicker: ({ label, value, onChange }: { label: string; value?: string; onChange: (id?: string) => void }) => (
    <label>
      {label}
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">—</option>
        {[...entities.values()].map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name}
          </option>
        ))}
      </select>
    </label>
  ),
}))

function rel(id: string, typeId: string, source: string, target: string, extra: Partial<EntityRelationship> = {}) {
  return {
    id,
    seq: 0,
    campaignId: 'c1',
    sourceEntityId: source,
    targetEntityId: target,
    relationshipTypeId: typeId,
    description: null,
    visibility: 'public' as const,
    createdAt: '',
    updatedAt: '',
    ...extra,
  }
}

beforeEach(() => {
  entities = new Map(
    [
      makeEntity('blackwall', 'Blackwall', 'location', { parentLocationEntityId: 'march' }),
      makeEntity('march', 'Northern March', 'location'),
      makeEntity('inn', 'The Ember & Anvil', 'location'),
      makeEntity('renald', 'Duke Renald', 'character'),
      makeEntity('mara', 'Mara Voss', 'character', { currentLocationEntityId: 'blackwall' }),
      makeEntity('guard', 'Ashen Guard', 'faction'),
    ].map((entity) => [entity.id, entity]),
  )
  stored = [
    rel('r-renald', 'controls', 'renald', 'blackwall', { description: 'Through his steward' }),
    rel('r-guard', 'located', 'guard', 'blackwall', { visibility: 'gm_only' }),
  ]
  failCreate = null
  failDelete = null
  created.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

function renderManager({ role = 'gm', compact = false, entityId = 'blackwall' }: { role?: CampaignRole; compact?: boolean; entityId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const entity = entities.get(entityId)!
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ConnectionsManager
          campaignId="c1"
          entity={entity}
          metadata={entity.metadataJson}
          canEdit={role !== 'player' && role !== 'viewer'}
          campaignRole={role}
          detailsUrl="/app/campaign/c1/world/blackwall/edit/details"
          compact={compact}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const table = () => screen.getByRole('table', { name: /Relationships of/ })
const form = () => screen.getByRole('form', { name: 'Add a relationship' })

async function choose(relationship: string, entry: string) {
  await screen.findByRole('option', { name: relationship })
  fireEvent.change(within(form()).getByLabelText(/…$/), {
    target: { value: within(form()).getByRole('option', { name: relationship }).getAttribute('value') },
  })
  const picker = within(form()).getByLabelText('Entry')
  fireEvent.change(picker, {
    target: { value: within(picker).getByRole('option', { name: entry }).getAttribute('value') },
  })
}

describe('ConnectionsManager', () => {
  it('lists relationships with direction-aware labels, entry type, note and visibility', async () => {
    renderManager()
    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      'ContainsAshen Guard · Faction—GM only',
      'Controlled byDuke Renald · CharacterThrough his stewardEveryone',
    ])
    // Details-owned connection is shown, but edited on Details.
    const details = screen.getByRole('region', { name: 'From details' })
    expect(within(details).getByText('Parent location')).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'Edit them on the Details tab' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/blackwall/edit/details',
    )
  })

  it('adds from the other end by swapping source and target', async () => {
    renderManager()
    await choose('Contains', 'The Ember & Anvil')
    fireEvent.change(within(form()).getByLabelText('Note (optional)'), { target: { value: 'By the market' } })
    await waitFor(() => expect(within(form()).getByRole('button', { name: 'Add' })).toBeEnabled())
    fireEvent.click(within(form()).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(within(table()).getByText('The Ember & Anvil')).toBeInTheDocument())
    expect(created).toEqual([
      {
        sourceEntityId: 'inn',
        targetEntityId: 'blackwall',
        relationshipTypeId: 'located',
        description: 'By the market',
        visibility: 'public',
      },
    ])
    expect(screen.getByText('Added: Blackwall contains The Ember & Anvil')).toBeInTheDocument()
  })

  it('explains a duplicate instead of sending it', async () => {
    renderManager()
    await choose('Controlled by', 'Duke Renald')
    expect(await within(form()).findByRole('alert')).toHaveTextContent(
      'Blackwall is already “controlled by” Duke Renald.',
    )
    expect(within(form()).getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(created).toEqual([])
  })

  it('points to the Details field when metadata already states the fact', async () => {
    renderManager()
    await choose('Located in', 'Northern March')
    const alert = await within(form()).findByRole('alert')
    expect(alert).toHaveTextContent(
      'Blackwall’s Parent location is already Northern March, which says the same thing. That field is edited on the Details tab.',
    )
    expect(within(alert).getByRole('link', { name: 'Go to Details' })).toBeInTheDocument()

    // From the other end: "Blackwall contains Mara" is Mara's Current location.
    await choose('Contains', 'Mara Voss')
    const other = await within(form()).findByRole('alert')
    expect(other).toHaveTextContent(
      'Mara Voss’s Current location is already Blackwall, which says the same thing.',
    )
    expect(within(other).getByRole('link', { name: 'Edit Mara Voss' })).toBeInTheDocument()
  })

  it('catches the other entity’s field when adding from this end', async () => {
    renderManager({ entityId: 'march' })
    await choose('Contains', 'Blackwall')
    const alert = await within(form()).findByRole('alert')
    expect(alert).toHaveTextContent('Blackwall’s Parent location is already Northern March')
    expect(within(alert).getByRole('link', { name: 'Edit Blackwall' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/blackwall/edit/details',
    )
  })

  it('removes, offers Undo, and re-creates the same type, direction, note and visibility', async () => {
    renderManager()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Blackwall controlled by Duke Renald' }))
    await waitFor(() => expect(within(table()).queryByText('Duke Renald')).not.toBeInTheDocument())
    expect(await screen.findByText(/Undo is available for 10 seconds/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(within(table()).getByText('Duke Renald')).toBeInTheDocument())
    expect(created).toEqual([
      {
        relationshipTypeId: 'controls',
        sourceEntityId: 'renald',
        targetEntityId: 'blackwall',
        description: 'Through his steward',
        visibility: 'public',
      },
    ])
    expect(await screen.findAllByText('Restored: Blackwall controlled by Duke Renald')).not.toHaveLength(0)
  })

  it('restores GM-only visibility too', async () => {
    renderManager()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Blackwall contains Ashen Guard' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({ sourceEntityId: 'guard', targetEntityId: 'blackwall', visibility: 'gm_only' })
  })

  it('reports an Undo the server refused, without claiming it was restored', async () => {
    renderManager()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Blackwall controlled by Duke Renald' }))
    failCreate = new ApiError('This relationship already exists', 409)
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(
      await screen.findAllByText(
        '“Blackwall controlled by Duke Renald” wasn’t restored: the same relationship was added again in the meantime.',
      ),
    ).not.toHaveLength(0)
    expect(screen.queryByText(/^Restored:/)).not.toBeInTheDocument()
  })

  it('keeps the row and says so when removal fails', async () => {
    failDelete = new ApiError('Boom', 500)
    renderManager()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Blackwall controlled by Duke Renald' }))
    expect(await screen.findAllByText(/Couldn’t remove “Blackwall controlled by Duke Renald”: Boom/)).not.toHaveLength(0)
    expect(within(table()).getByText('Duke Renald')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('moves focus to Undo for keyboard removals, and Undo expires after 10 seconds', async () => {
    renderManager()
    await screen.findByRole('table')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // A keyboard "click" has detail 0.
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Blackwall controlled by Duke Renald' }), { detail: 0 })
    const undo = await screen.findByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()
    // Paused while focused; leaving it starts the countdown.
    act(() => undo.blur())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_900)
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('filters a long list', async () => {
    for (let i = 0; i < 6; i += 1) {
      entities.set(`ally${i}`, makeEntity(`ally${i}`, `Ally ${i}`, 'character'))
      stored.push(rel(`a${i}`, 'ally', 'blackwall', `ally${i}`))
    }
    renderManager()
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Filter relationships'), { target: { value: 'renald' } })
    expect(within(table()).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('1 of 8')).toBeInTheDocument()
  })

  it('players see relationships but no add or remove controls', async () => {
    renderManager({ role: 'player' })
    await screen.findByRole('table')
    expect(screen.queryByRole('form', { name: 'Add a relationship' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
  })

  it('editors (not GMs) get no GM-only option', async () => {
    renderManager({ role: 'editor' })
    await screen.findByRole('table')
    expect(within(form()).queryByLabelText('Visible to')).not.toBeInTheDocument()
  })

  it('phones: a list, and adding happens in a bottom sheet', async () => {
    renderManager({ compact: true })
    const list = await screen.findByRole('list', { name: 'Relationships of Blackwall' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('form', { name: 'Add a relationship' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add relationship' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a relationship' })
    expect(sheet.className).toContain('wb-dialog__panel--sheet')
    await choose('Contains', 'The Ember & Anvil')
    await waitFor(() => expect(within(form()).getByRole('button', { name: 'Add' })).toBeEnabled())
    fireEvent.click(within(form()).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(screen.getByRole('list', { name: 'Relationships of Blackwall' })).getByText('The Ember & Anvil')).toBeInTheDocument()
  })
})
