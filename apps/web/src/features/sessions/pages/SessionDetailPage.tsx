import type { WorldDate } from '@worldbinder/contracts'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityPicker } from '../../entities/components/EntityPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import {
  useCompleteSessionMutation,
  useDeleteSessionMutation,
  useRevealEntityMutation,
  useSessionQuery,
} from '../hooks/useSessions'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])
const REVEAL_ROLES = new Set(['owner', 'gm'])

function formatWorldDate(date: WorldDate | null): string | null {
  if (!date) return null
  return (
    date.label ??
    `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  )
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const sessionQuery = useSessionQuery(campaign.id, sessionId)
  const deleteSession = useDeleteSessionMutation(campaign.id)
  const completeSession = useCompleteSessionMutation(campaign.id, sessionId ?? '')
  const revealEntity = useRevealEntityMutation(campaign.id, sessionId ?? '')

  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const canReveal = REVEAL_ROLES.has(campaign.role)

  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [worldEndYear, setWorldEndYear] = useState('')
  const [worldEndMonth, setWorldEndMonth] = useState('')
  const [worldEndDay, setWorldEndDay] = useState('')
  const [revealEntityId, setRevealEntityId] = useState<string | undefined>(undefined)

  if (sessionQuery.isLoading) return <p>Loading…</p>
  if (sessionQuery.isError || !sessionQuery.data) {
    return <FormMessage message="This session could not be found." />
  }

  const session = sessionQuery.data

  async function handleComplete() {
    const worldEndDateJson =
      worldEndYear && worldEndMonth && worldEndDay
        ? {
            schemaVersion: 1 as const,
            year: Number(worldEndYear),
            month: Number(worldEndMonth),
            day: Number(worldEndDay),
          }
        : undefined
    await completeSession.mutateAsync({ updatedAt: session.updatedAt, worldEndDateJson })
    setShowCompleteForm(false)
  }

  async function handleReveal() {
    if (!revealEntityId) return
    await revealEntity.mutateAsync({ entityId: revealEntityId })
    setRevealEntityId(undefined)
  }

  return (
    <section>
      <header className="wb-entity-header">
        <h1>
          Session {session.sessionNumber}: {session.title}
        </h1>
        <span className="wb-entity-header__meta">
          {session.status}
          {session.visibility === 'gm_only' ? ' · GM only' : ''}
          {formatWorldDate(session.worldStartDateJson) &&
            ` · Starts ${formatWorldDate(session.worldStartDateJson)}`}
          {formatWorldDate(session.worldEndDateJson) &&
            ` · Ends ${formatWorldDate(session.worldEndDateJson)}`}
        </span>
      </header>

      {canManage && (
        <div className="wb-entity-header__actions">
          <Link
            className="wb-button wb-button--secondary"
            to={`/app/campaign/${campaign.id}/sessions/${session.id}/edit`}
          >
            Edit
          </Link>
          {session.status !== 'completed' && !showCompleteForm && (
            <Button onClick={() => setShowCompleteForm(true)}>Complete session</Button>
          )}
          <Button
            variant="secondary"
            disabled={deleteSession.isPending}
            onClick={() => {
              if (!window.confirm(`Delete "${session.title}"? This cannot be undone.`)) return
              deleteSession.mutate(session.id, {
                onSuccess: () => navigate(`/app/campaign/${campaign.id}/sessions`),
              })
            }}
          >
            Delete
          </Button>
        </div>
      )}

      {showCompleteForm && (
        <div className="wb-form">
          <h2>Complete session</h2>
          <fieldset className="wb-field">
            <legend className="wb-field__label">In-world end date (optional)</legend>
            <TextField
              id="worldEndYear"
              label="Year"
              type="number"
              value={worldEndYear}
              onChange={(e) => setWorldEndYear(e.target.value)}
            />
            <TextField
              id="worldEndMonth"
              label="Month"
              type="number"
              min={1}
              max={12}
              value={worldEndMonth}
              onChange={(e) => setWorldEndMonth(e.target.value)}
            />
            <TextField
              id="worldEndDay"
              label="Day"
              type="number"
              min={1}
              max={31}
              value={worldEndDay}
              onChange={(e) => setWorldEndDay(e.target.value)}
            />
          </fieldset>
          <FormMessage message={completeSession.error?.message} />
          <div className="wb-entity-header__actions">
            <Button onClick={() => void handleComplete()} disabled={completeSession.isPending}>
              Confirm completion
            </Button>
            <Button variant="secondary" onClick={() => setShowCompleteForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <RichTextEditor
        label="Recap"
        content={session.recapContentJson}
        editable={false}
        campaignId={campaign.id}
      />

      {'plannedContentJson' in session && (
        <RichTextEditor
          label="Planned content (GM only)"
          content={session.plannedContentJson ?? null}
          editable={false}
          campaignId={campaign.id}
        />
      )}
      {'gmContentJson' in session && (
        <RichTextEditor
          label="GM-only notes"
          content={session.gmContentJson ?? null}
          editable={false}
          campaignId={campaign.id}
        />
      )}

      <div className="wb-related-content">
        <div>
          <h2>Participants</h2>
          {session.participants.length === 0 && <p>No participants recorded.</p>}
          <ul className="wb-relationship-list">
            {session.participants.map((p) => (
              <li key={p.campaignMemberId}>{p.displayName}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Featured Entities</h2>
          {session.featuredEntities.length === 0 && <p>No featured entities.</p>}
          <ul className="wb-relationship-list">
            {session.featuredEntities.map((e) => (
              <li key={e.id}>
                <Link to={`/app/campaign/${campaign.id}/world/${e.id}`}>{e.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Locations</h2>
          {session.locations.length === 0 && <p>No locations recorded.</p>}
          <ul className="wb-relationship-list">
            {session.locations.map((e) => (
              <li key={e.id}>
                <Link to={`/app/campaign/${campaign.id}/world/${e.id}`}>{e.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Discoveries</h2>
          {session.reveals.length === 0 && <p>Nothing revealed yet.</p>}
          <ul className="wb-relationship-list">
            {session.reveals.map((e) => (
              <li key={e.id}>
                <Link to={`/app/campaign/${campaign.id}/world/${e.id}`}>{e.name}</Link>
              </li>
            ))}
          </ul>

          {canReveal && (
            <div className="wb-form">
              <EntityPicker
                campaignId={campaign.id}
                label="Reveal a hidden entity"
                value={revealEntityId}
                onChange={setRevealEntityId}
              />
              <FormMessage message={revealEntity.error?.message} />
              <Button
                onClick={() => void handleReveal()}
                disabled={!revealEntityId || revealEntity.isPending}
              >
                Reveal to players
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
