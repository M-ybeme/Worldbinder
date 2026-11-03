import type { EntityDetail } from '@worldbinder/contracts'
import { Badge, Dialog } from '@worldbinder/ui'
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useEffect, useId, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  useEntityBacklinksQuery,
  useEntityRelationshipsQuery,
} from '../../../relationships/hooks/useRelationships'
import {
  useEntityPlotThreadsQuery,
  useEntitySessionsQuery,
  useReferencedEntities,
} from '../../hooks/useEntities'
import { readReferences } from '../../lib/entityFacts'
import { mergeConnections } from '../../lib/mergeConnections'

const PREFERENCE_KEY = 'wb.editor.referencePanel'

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) !== 'closed'
  } catch {
    return true
  }
}

function writePreference(open: boolean) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, open ? 'open' : 'closed')
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}

/** Keeps focus — and the editor's caret and selection — where they are
 * when the panel is toggled with a mouse. Keyboard users act on the
 * focused button itself, so nothing moves for them either. */
const keepEditorFocus = (event: MouseEvent) => event.preventDefault()

/**
 * What a writer looks up while writing an entry: what it's connected to,
 * where it's mentioned, its plot threads and the sessions it appears in —
 * read from the same endpoints as the article, fetched only while the
 * panel is open.
 *
 * - `layout="side"`: a 280px column beside the editor when there's room,
 *   collapsible to a narrow rail (remembered on this device).
 * - `layout="rail"`: not enough room beside the editor — always the rail;
 *   opening it overlays the panel instead of squeezing the editor.
 * - `layout="sheet"`: phones — a "Reference" button and a bottom sheet.
 *
 * Links open in a new tab, so the editor (and anything not yet saved)
 * stays put. Toggling never touches the editor: it's a sibling, never
 * remounted, and the toggle doesn't take focus from it on click.
 */
export function ReferencePanel({
  campaignId,
  entity,
  metadata,
  layout,
  active,
  connectionsUrl,
}: {
  campaignId: string
  entity: EntityDetail
  /** The Details tab's current values (possibly unsaved). */
  metadata: Record<string, unknown> | null
  layout: 'side' | 'rail' | 'sheet'
  /** False while another editor tab is showing: nothing is fetched. */
  active: boolean
  connectionsUrl: string
}) {
  const [preferOpen, setPreferOpen] = useState(readPreference)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const panelId = useId()

  // The overlay is only for narrow layouts; widening closes it.
  useEffect(() => {
    if (layout === 'side') setOverlayOpen(false)
  }, [layout])

  // Escape closes the overlay (the side column and the sheet have their own
  // controls; the sheet's Dialog handles Escape itself).
  useEffect(() => {
    if (layout !== 'rail' || !overlayOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverlayOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [layout, overlayOpen])

  const expanded = layout === 'side' ? preferOpen : overlayOpen
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entity.id)
  // Relationships plus detail-field references (a relationship stating the
  // same fact as a field is counted once).
  const references = readReferences(entity.entityType, metadata)
  const count =
    (relationshipsQuery.data ?? []).filter(
      (rel) =>
        rel.visibility !== 'public' ||
        !references.some(
          (reference) =>
            reference.entityId === rel.otherEntity.id && reference.sameFactLabels.includes(rel.label),
        ),
    ).length + references.length

  const toggleSide = (open: boolean) => {
    setPreferOpen(open)
    writePreference(open)
  }

  const content = (
    <ReferenceContent
      campaignId={campaignId}
      entity={entity}
      metadata={metadata}
      enabled={active && expanded}
      connectionsUrl={connectionsUrl}
    />
  )

  if (layout === 'sheet') {
    return (
      <div className="wb-reference wb-reference--sheet">
        <button
          type="button"
          className="wb-reference__open-sheet"
          onClick={() => setOverlayOpen(true)}
        >
          <BookOpen size={16} aria-hidden="true" />
          Reference
          {count > 0 && <span className="wb-reference__count">{count} connections</span>}
        </button>
        <Dialog
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          title="Reference"
          placement="sheet"
        >
          {content}
        </Dialog>
      </div>
    )
  }

  return (
    <aside
      className={[
        'wb-reference',
        expanded ? 'wb-reference--open' : 'wb-reference--closed',
        layout === 'rail' ? 'wb-reference--overlay' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Reference"
    >
      {expanded ? (
        <div id={panelId} className="wb-reference__panel">
          <div className="wb-reference__head">
            <h2 className="wb-reference__title">Reference</h2>
            <button
              type="button"
              className="wb-icon-button"
              aria-label="Hide reference panel"
              aria-expanded="true"
              aria-controls={panelId}
              onMouseDown={keepEditorFocus}
              onClick={() => (layout === 'side' ? toggleSide(false) : setOverlayOpen(false))}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          {content}
        </div>
      ) : (
        <button
          type="button"
          className="wb-reference__rail"
          aria-label={`Show reference panel${count > 0 ? ` (${count} connections)` : ''}`}
          aria-expanded="false"
          onMouseDown={keepEditorFocus}
          onClick={() => (layout === 'side' ? toggleSide(true) : setOverlayOpen(true))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="wb-reference__rail-label" aria-hidden="true">
            Reference{count > 0 && ` · ${count} connections`}
          </span>
        </button>
      )}
    </aside>
  )
}

function ReferenceContent({
  campaignId,
  entity,
  metadata,
  enabled,
  connectionsUrl,
}: {
  campaignId: string
  entity: EntityDetail
  metadata: Record<string, unknown> | null
  enabled: boolean
  connectionsUrl: string
}) {
  // Already cached when the article was open; fetched here otherwise.
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entity.id)
  const backlinksQuery = useEntityBacklinksQuery(campaignId, enabled ? entity.id : '')
  const threadsQuery = useEntityPlotThreadsQuery(campaignId, enabled ? entity.id : undefined)
  const sessionsQuery = useEntitySessionsQuery(campaignId, enabled ? entity.id : undefined)
  const references = readReferences(entity.entityType, metadata)
  const referenced = useReferencedEntities(
    campaignId,
    enabled ? references.map((reference) => reference.entityId) : [],
  )
  const { derived, relationships } = mergeConnections(
    references.flatMap((reference) => {
      const target = referenced.entities.get(reference.entityId)
      return target ? [{ ...reference, target }] : []
    }),
    relationshipsQuery.data ?? [],
  )
  const worldUrl = (id: string) => `/app/campaign/${campaignId}/world/${id}`
  const backlinks = enabled ? (backlinksQuery.data ?? []) : []
  const threads = threadsQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const connected = [
    ...derived.map((item) => ({
      key: item.key,
      to: worldUrl(item.target.id),
      name: item.target.name,
      label: item.connectionLabel,
      gmOnly: item.target.visibility === 'gm_only',
    })),
    ...relationships.map((rel) => ({
      key: rel.relationshipId,
      to: worldUrl(rel.otherEntity.id),
      name: rel.otherEntity.name,
      label: rel.label,
      gmOnly: rel.visibility === 'gm_only',
    })),
  ]

  return (
    <div className="wb-reference__content">
      <ReferenceGroup title="Connected to" empty="No connections yet.">
        {connected.map((item) => (
          <li key={item.key}>
            <NewTabLink to={item.to}>{item.name}</NewTabLink>
            <span className="wb-reference__muted"> · {item.label.toLowerCase()}</span>
            {item.gmOnly && <Badge tone="warning">GM only</Badge>}
          </li>
        ))}
      </ReferenceGroup>
      <Link className="wb-reference__manage" to={connectionsUrl}>
        Manage connections →
      </Link>
      <ReferenceGroup title="Mentioned in" empty="No other entry mentions it yet.">
        {backlinks.map((link) => (
          <li key={`${link.sourceEntity.id}-${link.section}`}>
            <NewTabLink to={worldUrl(link.sourceEntity.id)}>{link.sourceEntity.name}</NewTabLink>
            {link.section === 'gm' && <span className="wb-reference__muted"> · GM notes</span>}
          </li>
        ))}
      </ReferenceGroup>
      <ReferenceGroup title="Plot threads" empty="Not part of any plot thread yet.">
        {threads.map((thread) => (
          <li key={thread.id}>
            <NewTabLink to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</NewTabLink>
          </li>
        ))}
      </ReferenceGroup>
      <ReferenceGroup title="Appears in" empty="No session appearances yet.">
        {sessions.map((session) => (
          <li key={session.id}>
            <NewTabLink to={`/app/campaign/${campaignId}/sessions/${session.id}`}>
              Session {session.sessionNumber} — {session.title}
            </NewTabLink>
          </li>
        ))}
      </ReferenceGroup>
      <p className="wb-reference__note">Links open in a new tab, so this editor stays open.</p>
    </div>
  )
}

function ReferenceGroup({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  const id = useId()
  return (
    <section className="wb-reference__group" aria-labelledby={id}>
      <h3 id={id} className="wb-reference__eyebrow">
        {title}
      </h3>
      {children.length > 0 ? (
        <ul className="wb-reference__list">{children}</ul>
      ) : (
        <p className="wb-reference__muted">{empty}</p>
      )}
    </section>
  )
}

function NewTabLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={12} aria-hidden="true" className="wb-reference__external" />
      <span className="wb-visually-hidden"> (opens in a new tab)</span>
    </Link>
  )
}
