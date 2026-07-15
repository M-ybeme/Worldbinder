import type { EntityVisibility, TiptapDoc } from '@worldbinder/contracts'
import { DEFAULT_CALENDAR_CONFIG, type PlotThreadChangeInput } from '@worldbinder/validation'
import { Button, FormMessage, Select, TextField } from '@worldbinder/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
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
import {
  useCreateSessionMutation,
  useSessionQuery,
  useUpdateSessionMutation,
} from '../hooks/useSessions'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

export function SessionFormPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const isEditMode = !!sessionId
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const sessionQuery = useSessionQuery(campaign.id, sessionId)
  const membersQuery = useMembersQuery(campaign.id)
  const createSession = useCreateSessionMutation(campaign.id)
  const updateSession = useUpdateSessionMutation(campaign.id, sessionId ?? '')

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
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditMode || !sessionQuery.data) return
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
    setUpdatedAt(session.updatedAt)
  }, [isEditMode, sessionQuery.data])

  function toggleParticipant(campaignMemberId: string) {
    setParticipantIds((ids) =>
      ids.includes(campaignMemberId)
        ? ids.filter((id) => id !== campaignMemberId)
        : [...ids, campaignMemberId],
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    const worldStartDateJson = structuredToWorldDate(worldStartDate)

    if (isEditMode) {
      if (!updatedAt) return
      const result = await updateSession.mutateAsync({
        updatedAt,
        title,
        visibility,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        worldStartDateJson: worldStartDateJson ?? null,
        recapContentJson: recapContent ?? undefined,
        ...(canSetGmContent
          ? { plannedContentJson: plannedContent, gmContentJson: gmContent }
          : {}),
        participantIds,
        featuredEntityIds,
        locationEntityIds,
        plotThreadChanges,
      })
      navigate(`/app/campaign/${campaign.id}/sessions/${result.id}`)
      return
    }

    const result = await createSession.mutateAsync({
      title,
      visibility,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      worldStartDateJson,
      ...(canSetGmContent ? { plannedContentJson: plannedContent ?? undefined } : {}),
      participantIds,
      featuredEntityIds,
      locationEntityIds,
      plotThreadChanges,
    })
    navigate(`/app/campaign/${campaign.id}/sessions/${result.id}`)
  }

  if (isEditMode && sessionQuery.isLoading) return <p>Loading…</p>
  if (isEditMode && sessionQuery.isError) {
    return <FormMessage message="This session could not be loaded." />
  }

  const mutation = isEditMode ? updateSession : createSession

  return (
    <section>
      <h1>{isEditMode ? 'Edit session' : 'New session'}</h1>

      <form className="wb-form" onSubmit={(e) => void onSubmit(e)} noValidate>
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
          <RichTextEditor
            label="Planned content (GM only)"
            content={plannedContent}
            onChange={setPlannedContent}
            campaignId={campaign.id}
          />
        )}

        <RichTextEditor
          label="Recap (public)"
          content={recapContent}
          onChange={setRecapContent}
          campaignId={campaign.id}
        />

        {canSetGmContent && (
          <RichTextEditor
            label="GM-only notes"
            content={gmContent}
            onChange={setGmContent}
            campaignId={campaign.id}
          />
        )}

        <div className="wb-field">
          <span className="wb-field__label">Participants</span>
          {membersQuery.data?.map((member) => (
            <label key={member.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={participantIds.includes(member.id)}
                onChange={() => toggleParticipant(member.id)}
              />{' '}
              {member.displayName}
            </label>
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

        <FormMessage message={mutation.error?.message} />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEditMode ? 'Save changes' : 'Create session'}
        </Button>
      </form>
    </section>
  )
}
