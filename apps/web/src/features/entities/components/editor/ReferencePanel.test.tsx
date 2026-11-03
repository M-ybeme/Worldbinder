import type { EntityDetail } from '@worldbinder/contracts'
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReferencePanel } from './ReferencePanel'

const fetched: string[] = []
const entity = {
  id: 'blackwall',
  name: 'Blackwall',
  entityType: 'location',
  metadataJson: null,
} as unknown as EntityDetail

const march = { id: 'march', name: 'Northern March', visibility: 'public' } as EntityDetail

vi.mock('../../../relationships/hooks/useRelationships', () => ({
  useEntityRelationshipsQuery: () => ({
    data: [
      {
        relationshipId: 'r1',
        relationshipTypeId: 't',
        direction: 'incoming',
        label: 'Controlled by',
        otherEntity: { id: 'renald', name: 'Duke Renald' },
        description: null,
        visibility: 'public',
      },
      {
        relationshipId: 'r2',
        relationshipTypeId: 't2',
        direction: 'incoming',
        label: 'Contains',
        otherEntity: { id: 'tunnels', name: 'Gatehouse Tunnels' },
        description: null,
        visibility: 'gm_only',
      },
    ],
  }),
  useEntityBacklinksQuery: (_c: string, id: string) => {
    if (id) fetched.push('backlinks')
    return { data: id ? [{ sourceEntity: { id: 'mara', name: 'Captain Mara Voss' }, section: 'public' }] : undefined }
  },
}))

vi.mock('../../hooks/useEntities', () => ({
  useEntityPlotThreadsQuery: (_c: string, id?: string) => {
    if (id) fetched.push('threads')
    return { data: id ? [{ id: 'caravan', title: 'The Missing Caravan' }] : undefined }
  },
  useEntitySessionsQuery: (_c: string, id?: string) => {
    if (id) fetched.push('sessions')
    return { data: id ? [{ id: 's4', sessionNumber: 4, title: 'Ash on the Road' }] : undefined }
  },
  useReferencedEntities: (_c: string, ids: string[]) => ({
    entities: new Map(ids.map((id) => [id, id === 'march' ? march : null])),
    isLoading: false,
  }),
}))

beforeEach(() => {
  fetched.length = 0
  window.localStorage.clear()
})

function renderPanel(layout: 'side' | 'rail' | 'sheet' = 'side', active = true) {
  return render(
    <MemoryRouter>
      <ReferencePanel
        campaignId="c1"
        entity={entity}
        metadata={{ parentLocationEntityId: 'march' }}
        layout={layout}
        active={active}
        connectionsUrl="/app/campaign/c1/world/blackwall/edit/connections"
      />
    </MemoryRouter>,
  )
}

describe('ReferencePanel', () => {
  it('shows connections (details and relationships), mentions, threads and sessions; links open in a new tab', () => {
    renderPanel()
    const panel = screen.getByRole('complementary', { name: 'Reference' })
    const connected = within(panel).getByRole('region', { name: 'Connected to' })
    expect(connected).toHaveTextContent('Northern March (opens in a new tab) · located in')
    expect(connected).toHaveTextContent('Duke Renald (opens in a new tab) · controlled by')
    expect(connected).toHaveTextContent('Gatehouse Tunnels (opens in a new tab) · containsGM only')
    for (const name of ['Northern March', 'Captain Mara Voss', 'The Missing Caravan', 'Session 4 — Ash on the Road']) {
      const link = within(panel).getByRole('link', { name: `${name} (opens in a new tab)` })
      expect(link).toHaveAttribute('target', '_blank')
    }
    expect(within(panel).getByRole('link', { name: 'Manage connections →' })).toHaveAttribute(
      'href',
      '/app/campaign/c1/world/blackwall/edit/connections',
    )
    expect(panel).toHaveTextContent('Links open in a new tab, so this editor stays open.')
  })

  it('collapses to a rail and remembers that on this device', () => {
    const { unmount } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Hide reference panel' }))
    const rail = screen.getByRole('button', { name: 'Show reference panel (3 connections)' })
    expect(rail).toHaveAttribute('aria-expanded', 'false')
    expect(window.localStorage.getItem('wb.editor.referencePanel')).toBe('closed')
    unmount()
    renderPanel()
    expect(screen.getByRole('button', { name: /Show reference panel/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show reference panel/ }))
    expect(screen.getByRole('region', { name: 'Connected to' })).toBeInTheDocument()
  })

  it('toggling with the mouse doesn’t take focus (or the selection) from the editor', () => {
    renderPanel()
    for (const name of [/Hide reference panel/, /Show reference panel/]) {
      const button = screen.getByRole('button', { name })
      const mouseDown = createEvent.mouseDown(button)
      fireEvent(button, mouseDown)
      expect(mouseDown.defaultPrevented).toBe(true)
      fireEvent.click(button)
    }
  })

  it('fetches nothing extra while collapsed or on another tab', () => {
    window.localStorage.setItem('wb.editor.referencePanel', 'closed')
    renderPanel()
    expect(fetched).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /Show reference panel/ }))
    expect(fetched).toEqual(expect.arrayContaining(['backlinks', 'threads', 'sessions']))

    fetched.length = 0
    window.localStorage.clear()
    renderPanel('side', false)
    expect(fetched).toEqual([])
  })

  it('in the narrow rail layout it opens as an overlay, without changing the saved preference', () => {
    renderPanel('rail')
    fireEvent.click(screen.getByRole('button', { name: /Show reference panel/ }))
    const panel = screen.getByRole('complementary', { name: 'Reference' })
    expect(panel.className).toContain('wb-reference--overlay')
    fireEvent.click(screen.getByRole('button', { name: 'Hide reference panel' }))
    expect(window.localStorage.getItem('wb.editor.referencePanel')).toBeNull()
    // Escape closes the overlay too.
    fireEvent.click(screen.getByRole('button', { name: /Show reference panel/ }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Hide reference panel' }), { key: 'Escape' })
    expect(screen.getByRole('button', { name: /Show reference panel/ })).toBeInTheDocument()
  })

  it('phones: a Reference button opens the panel as a bottom sheet', () => {
    renderPanel('sheet')
    fireEvent.click(screen.getByRole('button', { name: /^Reference/ }))
    const sheet = screen.getByRole('dialog', { name: 'Reference' })
    expect(sheet.className).toContain('wb-dialog__panel--sheet')
    expect(within(sheet).getByRole('region', { name: 'Connected to' })).toBeInTheDocument()
  })
})
