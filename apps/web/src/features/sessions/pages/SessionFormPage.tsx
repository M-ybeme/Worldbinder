import type { EntityVisibility, TiptapDoc } from '@worldbinder/contracts'
import {
  DEFAULT_CALENDAR_CONFIG,
  type PlotThreadChangeInput,
  type UpdateSessionInput,
} from '@worldbinder/validation'
import {
  Button,
  Checkbox,
  ErrorState,
  FormMessage,
  LoadingState,
  Select,
  TagInput,
  TextField,
} from '@worldbinder/ui'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { clearDraft, loadDraft, type ResourceDraft } from '../../../lib/draftDb'
import { useAutosave } from '../../../lib/useAutosave'
import { useMembersQuery } from '../../membership/hooks/useCampaignMembers'
import { EntityMultiPicker } from '../../entities/components/EntityMultiPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { PlotThreadChangesEditor } from '../../plot-threads/components/PlotThreadChangesEditor'
import { StructuredDateEditor } from '../../calendar/components/StructuredDateEditor'
import {
  EMPTY_STRUCTURED_DATE,
  structuredToWorldDate,
  worldDateToStructured,
} from '../../calendar/lib/structuredDate'
import { useCampaignTagsQuery } from '../../tags/hooks/useTags'
import * as sessionsApi from '../api/sessionsApi'
import { useSessionQuery } from '../hooks/useSessions'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

const SAVE_STATUS_TEXT: Record<string, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  offline: 'Offline — changes saved locally',
  error: 'Save failed — changes saved locally',
}

export function SessionFormPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { campaign } = useCampaignOutletContext()

  const sessionQuery = useSessionQuery(campaign.id, sessionId)
  const membersQuery = useMembersQuery(campaign.id)
  const campaignTagsQuery = useCampaignTagsQuery(campaign.id)

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

  const hydratedRef = useRef(false)
  const skipNextAutosaveRef = useRef(true)

  useEffect(() => {
    if (!sessionQuery.data || hydratedRef.current) return
    const session = sessionQuery.data
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

  const autosave = useAutosave({
    resourceType: 'session',
    campaignId: campaign.id,
    resourceId: sessionId ?? '',
    enabled: hydratedRef.current,
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
    const needsWarning =
      autosave.status === 'offline' || autosave.status === 'error' || autosave.status === 'conflict'
    if (!needsWarning) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [autosave.status])

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

  return (
    <section>
      <h1>Edit session</h1>

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

      {autosave.status !== 'idle' && autosave.status !== 'conflict' && (
        <FormMessage
          tone={autosave.status === 'saved' ? 'success' : 'error'}
          message={SAVE_STATUS_TEXT[autosave.status] ?? null}
        />
      )}

      {autosave.status === 'conflict' && (
        <div className="wb-banner wb-banner--warning">
          <p>This session was changed elsewhere.</p>
          <Button
            onClick={() => {
              hydratedRef.current = false
              autosave.resolveConflict()
              void sessionQuery.refetch()
            }}
          >
            Reload
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const fresh = autosave.conflictUpdatedAt
              if (fresh) {
                setUpdatedAt(fresh)
                autosave.scheduleSave(buildUpdateInput(fresh))
              }
              autosave.resolveConflict()
            }}
          >
            Keep my changes
          </Button>
        </div>
      )}

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
              label="Planned content (GM only)"
              content={plannedContent}
              onChange={setPlannedContent}
              campaignId={campaign.id}
            />
          </div>
        )}

        <RichTextEditor
          label="Recap (public)"
          content={recapContent}
          onChange={setRecapContent}
          campaignId={campaign.id}
        />

        {canSetGmContent && (
          <div className="wb-gm-content">
            <RichTextEditor
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
