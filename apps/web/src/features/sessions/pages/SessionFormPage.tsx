import type { CampaignSessionDetail, EntityVisibility, TiptapDoc } from '@worldbinder/contracts'
import {
  DEFAULT_CALENDAR_CONFIG,
  type PlotThreadChangeInput,
  type UpdateSessionInput,
} from '@worldbinder/validation'
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  TagInput,
  TextField,
} from '@worldbinder/ui'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EditorSafetyPanels } from '../../editing/EditorSafetyPanels'
import { SaveStatusIndicator } from '../../editing/SaveStatusIndicator'
import { useEditorSafety } from '../../editing/useEditorSafety'
import { clearDraft, loadDraft, type ResourceDraft } from '../../../lib/draftDb'
import { useAutosave } from '../../../lib/useAutosave'
import { useMembersQuery } from '../../membership/hooks/useCampaignMembers'
import { EntityMultiPicker } from '../../entities/components/EntityMultiPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { PlotThreadChangesEditor } from '../../plot-threads/components/PlotThreadChangesEditor'
import { usePlotThreadsQuery } from '../../plot-threads/hooks/usePlotThreads'
import { StructuredDateEditor } from '../../calendar/components/StructuredDateEditor'
import {
  EMPTY_STRUCTURED_DATE,
  structuredToWorldDate,
  worldDateToStructured,
} from '../../calendar/lib/structuredDate'
import { useCampaignTagsQuery } from '../../tags/hooks/useTags'
import * as sessionsApi from '../api/sessionsApi'
import { useSessionQuery } from '../hooks/useSessions'
import { sessionDifferences } from '../lib/sessionConflict'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

// Same role set as the session page's Edit link; the API enforces it.
const EDIT_ROLES = new Set(['owner', 'gm', 'editor'])

export function SessionFormPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const sessionQuery = useSessionQuery(campaign.id, sessionId)
  const membersQuery = useMembersQuery(campaign.id)
  const campaignTagsQuery = useCampaignTagsQuery(campaign.id)
  const threadsQuery = usePlotThreadsQuery(campaign.id)

  const canEdit = EDIT_ROLES.has(campaign.role)
  const canSetGmContent = campaign.role === 'owner' || campaign.role === 'gm'
  const calendarConfig = campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG

  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [scheduledAt, setScheduledAt] = useState('')
  const [worldStartDate, setWorldStartDate] = useState(EMPTY_STRUCTURED_DATE)
  const [plannedContent, setPlannedContent] = useState<TiptapDoc | null>(null)
  const [recapContent, setRecapContent] = useState<TiptapDoc | null>(null)
  const [gmContent, setGmContent] = useState<TiptapDoc | null>(null)
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [featuredEntityIds, setFeaturedEntityIds] = useState<string[]>([])
  const [locationEntityIds, setLocationEntityIds] = useState<string[]>([])
  const [plotThreadChanges, setPlotThreadChanges] = useState<PlotThreadChangeInput[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [draftBanner, setDraftBanner] = useState<ResourceDraft | null>(null)
  // Rich-text editors take their content only on mount: bumping this
  // remounts them whenever their state is replaced (load, draft restore,
  // loading the server's version) so what's shown is what will be saved.
  const [formKey, setFormKey] = useState(0)

  const hydratedRef = useRef(false)
  const skipNextAutosaveRef = useRef(true)

  function hydrate(session: CampaignSessionDetail) {
    setTitle(session.title)
    setVisibility(session.visibility)
    setScheduledAt(session.scheduledAt ? session.scheduledAt.slice(0, 16) : '')
    setWorldStartDate(worldDateToStructured(session.worldStartDateJson))
    setRecapContent(session.recapContentJson)
    if ('plannedContentJson' in session) setPlannedContent(session.plannedContentJson ?? null)
    if ('gmContentJson' in session) setGmContent(session.gmContentJson ?? null)
    setParticipantIds(session.participants.map((p) => p.campaignMemberId))
    setFeaturedEntityIds(session.featuredEntities.map((e) => e.id))
    setLocationEntityIds(session.locations.map((e) => e.id))
    setPlotThreadChanges(
      session.plotThreadChanges.map((change) => ({
        plotThreadId: change.plotThread.id,
        action: change.action,
      })),
    )
    setTags(session.tags)
    setUpdatedAt(session.updatedAt)
    setFormKey((key) => key + 1)
  }

  useEffect(() => {
    if (!sessionQuery.data || hydratedRef.current) return
    hydrate(sessionQuery.data)
    hydratedRef.current = true
  }, [sessionQuery.data])

  useEffect(() => {
    let cancelled = false
    void loadDraft('session', campaign.id, sessionId ?? null).then((draft) => {
      if (!cancelled && draft) setDraftBanner(draft)
    })
    return () => {
      cancelled = true
    }
  }, [campaign.id, sessionId])

  function toggleParticipant(campaignMemberId: string) {
    setParticipantIds((ids) =>
      ids.includes(campaignMemberId)
        ? ids.filter((id) => id !== campaignMemberId)
        : [...ids, campaignMemberId],
    )
  }

  function buildUpdateInput(updatedAtOverride?: string): UpdateSessionInput {
    const worldStartDateJson = structuredToWorldDate(worldStartDate)
    return {
      updatedAt: updatedAtOverride ?? updatedAt ?? '',
      title,
      visibility,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      worldStartDateJson: worldStartDateJson ?? null,
      recapContentJson: recapContent ?? undefined,
      ...(canSetGmContent ? { plannedContentJson: plannedContent, gmContentJson: gmContent } : {}),
      participantIds,
      featuredEntityIds,
      locationEntityIds,
      plotThreadChanges,
      tags,
    }
  }

  /** The save payload for the server's version — the new baseline when the
   * user loads it, so showing it doesn't schedule a save. Mirrors
   * `buildUpdateInput` (state round-trips through the same conversions). */
  function inputFromServer(server: CampaignSessionDetail): UpdateSessionInput {
    const worldStartDateJson = structuredToWorldDate(worldDateToStructured(server.worldStartDateJson))
    const scheduled = server.scheduledAt ? server.scheduledAt.slice(0, 16) : ''
    return {
      updatedAt: server.updatedAt,
      title: server.title,
      visibility: server.visibility,
      scheduledAt: scheduled ? new Date(scheduled).toISOString() : null,
      worldStartDateJson: worldStartDateJson ?? null,
      recapContentJson: server.recapContentJson ?? undefined,
      ...(canSetGmContent
        ? {
            plannedContentJson: 'plannedContentJson' in server ? (server.plannedContentJson ?? null) : plannedContent,
            gmContentJson: 'gmContentJson' in server ? (server.gmContentJson ?? null) : gmContent,
          }
        : {}),
      participantIds: server.participants.map((p) => p.campaignMemberId),
      featuredEntityIds: server.featuredEntities.map((e) => e.id),
      locationEntityIds: server.locations.map((e) => e.id),
      plotThreadChanges: server.plotThreadChanges.map((c) => ({
        plotThreadId: c.plotThread.id,
        action: c.action,
      })),
      tags: server.tags,
    }
  }

  const autosave = useAutosave({
    resourceType: 'session',
    campaignId: campaign.id,
    resourceId: sessionId ?? '',
    enabled: hydratedRef.current && canEdit,
    save: (input: UpdateSessionInput) =>
      sessionsApi.updateSession(campaign.id, sessionId ?? '', input),
    onSaved: (session) => setUpdatedAt(session.updatedAt),
  })

  useEffect(() => {
    if (!hydratedRef.current || !updatedAt) return
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    autosave.scheduleSave(buildUpdateInput())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    updatedAt,
    title,
    visibility,
    scheduledAt,
    worldStartDate,
    plannedContent,
    recapContent,
    gmContent,
    participantIds,
    featuredEntityIds,
    locationEntityIds,
    plotThreadChanges,
    tags,
  ])

  useEffect(() => {
    // pending/saving too: the change is already in IndexedDB, but closing the
    // tab before it reaches the server shouldn't happen silently.
    const needsWarning = autosave.status !== 'idle' && autosave.status !== 'saved'
    if (!needsWarning) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [autosave.status])

  const sessionUrl = `/app/campaign/${campaign.id}/sessions/${sessionId}`
  const editUrl = `${sessionUrl}/edit`

  const safety = useEditorSafety({
    autosave,
    isWithinEditor: (pathname) => pathname === editUrl,
    fetchServer: useCallback(
      () => sessionsApi.getSession(campaign.id, sessionId ?? ''),
      [campaign.id, sessionId],
    ),
    applyKeepMine: (server: CampaignSessionDetail) => {
      skipNextAutosaveRef.current = true
      setUpdatedAt(server.updatedAt)
      autosave.scheduleSave(buildUpdateInput(server.updatedAt))
    },
    applyServer: (server: CampaignSessionDetail) => {
      hydrate(server)
      setDraftBanner(null)
      return inputFromServer(server)
    },
  })

  function applyDraft(draft: ResourceDraft) {
    const data = draft.data as Partial<UpdateSessionInput>
    if (typeof data.title === 'string') setTitle(data.title)
    if (data.visibility) setVisibility(data.visibility)
    if (data.scheduledAt) setScheduledAt(data.scheduledAt.slice(0, 16))
    if (data.worldStartDateJson) setWorldStartDate(worldDateToStructured(data.worldStartDateJson))
    if (data.recapContentJson) setRecapContent(data.recapContentJson as TiptapDoc)
    if ('plannedContentJson' in data)
      setPlannedContent((data.plannedContentJson as TiptapDoc) ?? null)
    if ('gmContentJson' in data) setGmContent((data.gmContentJson as TiptapDoc) ?? null)
    if (Array.isArray(data.participantIds)) setParticipantIds(data.participantIds)
    if (Array.isArray(data.featuredEntityIds)) setFeaturedEntityIds(data.featuredEntityIds)
    if (Array.isArray(data.locationEntityIds)) setLocationEntityIds(data.locationEntityIds)
    if (Array.isArray(data.plotThreadChanges)) setPlotThreadChanges(data.plotThreadChanges)
    if (Array.isArray(data.tags)) setTags(data.tags)
    setFormKey((key) => key + 1)
    setDraftBanner(null)
  }

  if (sessionQuery.isLoading) return <LoadingState label="Loading session…" />
  if (sessionQuery.isError) {
    return (
      <ErrorState
        message="This session could not be loaded."
        onRetry={() => sessionQuery.refetch()}
      />
    )
  }
  if (!canEdit) {
    return (
      <EmptyState
        message="You don’t have permission to edit this session."
        action={
          <Link className="wb-button wb-button--secondary" to={sessionUrl}>
            View the session
          </Link>
        }
      />
    )
  }

  const local = {
    title,
    visibility,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    worldStartDate: structuredToWorldDate(worldStartDate) ?? null,
    recapContent,
    participantIds,
    featuredEntityIds,
    locationEntityIds,
    plotThreadChanges,
    tags,
    ...(canSetGmContent ? { plannedContent, gmContent } : {}),
  }

  return (
    <section className="wb-record-editor">
      <header className="wb-record-editor__header">
        <div>
          <h1>Edit session</h1>
          <SaveStatusIndicator
            status={autosave.status}
            onRetry={() => void autosave.retry()}
            onReview={safety.conflict.openConflict}
          />
        </div>
        <Button variant="secondary" disabled={safety.guard.busy} onClick={() => navigate(sessionUrl)}>
          <ArrowLeft size={16} aria-hidden="true" />
          View session
        </Button>
      </header>

      {draftBanner && (
        <div className="wb-banner">
          <p>
            You have unsaved local changes from {new Date(draftBanner.savedAt).toLocaleString()}.
          </p>
          <Button onClick={() => applyDraft(draftBanner)}>Restore</Button>
          <Button
            variant="secondary"
            onClick={() => {
              void clearDraft('session', campaign.id, sessionId ?? null)
              setDraftBanner(null)
            }}
          >
            Discard
          </Button>
        </div>
      )}

      <EditorSafetyPanels
        safety={safety}
        status={autosave.status}
        campaignId={campaign.id}
        recordNoun="session"
        describe={(server: CampaignSessionDetail) => ({
          name: server.title,
          updatedAt: server.updatedAt,
          differences: sessionDifferences(local, server, {
            members: new Map((membersQuery.data ?? []).map((m) => [m.id, m.displayName])),
            threads: new Map((threadsQuery.data ?? []).map((t) => [t.id, t.title])),
          }),
        })}
      />

      <form className="wb-form wb-form--wide" onSubmit={(e) => e.preventDefault()} noValidate>
        <TextField
          id="title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Select
          id="visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
        />
        <TextField
          id="scheduledAt"
          label="Scheduled at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />

        <StructuredDateEditor
          legend="In-world start date"
          calendarConfig={calendarConfig}
          value={worldStartDate}
          onChange={setWorldStartDate}
          allowUndated={false}
          allowApproximate={false}
          fixedPrecision="day"
        />

        {canSetGmContent && (
          <div className="wb-gm-content">
            <RichTextEditor
              key={`planned-${formKey}`}
              label="Planned content (GM only)"
              content={plannedContent}
              onChange={setPlannedContent}
              campaignId={campaign.id}
            />
          </div>
        )}

        <RichTextEditor
          key={`recap-${formKey}`}
          label="Recap (public)"
          content={recapContent}
          onChange={setRecapContent}
          campaignId={campaign.id}
        />

        {canSetGmContent && (
          <div className="wb-gm-content">
            <RichTextEditor
              key={`gm-${formKey}`}
              label="GM-only notes"
              content={gmContent}
              onChange={setGmContent}
              campaignId={campaign.id}
            />
          </div>
        )}

        <div className="wb-field">
          <span className="wb-field__label">Participants</span>
          {membersQuery.data?.map((member) => (
            <Checkbox
              key={member.id}
              checked={participantIds.includes(member.id)}
              onChange={() => toggleParticipant(member.id)}
              label={member.displayName}
            />
          ))}
        </div>

        <EntityMultiPicker
          campaignId={campaign.id}
          label="Featured entities"
          value={featuredEntityIds}
          onChange={setFeaturedEntityIds}
        />
        <EntityMultiPicker
          campaignId={campaign.id}
          label="Locations"
          value={locationEntityIds}
          onChange={setLocationEntityIds}
          entityType="location"
        />

        <PlotThreadChangesEditor
          campaignId={campaign.id}
          value={plotThreadChanges}
          onChange={setPlotThreadChanges}
        />

        <TagInput
          label="Tags"
          value={tags}
          onChange={setTags}
          suggestions={campaignTagsQuery.data?.map((t) => t.name)}
        />
      </form>
    </section>
  )
}
