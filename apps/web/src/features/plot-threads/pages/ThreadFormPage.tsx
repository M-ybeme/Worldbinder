import type { EntityVisibility, PlotThreadImportance, TiptapDoc } from '@worldbinder/contracts'
import type { UpdatePlotThreadInput } from '@worldbinder/validation'
import {
  Button,
  ErrorState,
  FormMessage,
  LoadingState,
  Select,
  TagInput,
  TextField,
  Textarea,
} from '@worldbinder/ui'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { clearDraft, loadDraft, type ResourceDraft } from '../../../lib/draftDb'
import { useAutosave } from '../../../lib/useAutosave'
import { EntityMultiPicker } from '../../entities/components/EntityMultiPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { useCampaignTagsQuery } from '../../tags/hooks/useTags'
import * as plotThreadsApi from '../api/plotThreadsApi'
import { usePlotThreadQuery } from '../hooks/usePlotThreads'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

const IMPORTANCE_OPTIONS = [
  { value: 'minor', label: 'Minor' },
  { value: 'standard', label: 'Standard' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
]

const SAVE_STATUS_TEXT: Record<string, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  offline: 'Offline — changes saved locally',
  error: 'Save failed — changes saved locally',
}

export function ThreadFormPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const { campaign } = useCampaignOutletContext()

  const threadQuery = usePlotThreadQuery(campaign.id, threadId)
  const campaignTagsQuery = useCampaignTagsQuery(campaign.id)

  const canSetGmContent = campaign.role === 'owner' || campaign.role === 'gm'

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [importance, setImportance] = useState<PlotThreadImportance>('standard')
  const [publicContent, setPublicContent] = useState<TiptapDoc | null>(null)
  const [gmContent, setGmContent] = useState<TiptapDoc | null>(null)
  const [entityIds, setEntityIds] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [draftBanner, setDraftBanner] = useState<ResourceDraft | null>(null)

  const hydratedRef = useRef(false)
  const skipNextAutosaveRef = useRef(true)

  useEffect(() => {
    if (!threadQuery.data || hydratedRef.current) return
    const thread = threadQuery.data
    setTitle(thread.title)
    setSummary(thread.summary ?? '')
    setVisibility(thread.visibility)
    if (thread.importance) setImportance(thread.importance)
    setPublicContent(thread.publicContentJson)
    if ('gmContentJson' in thread) setGmContent(thread.gmContentJson ?? null)
    setEntityIds(thread.entities.map((e) => e.id))
    setTags(thread.tags)
    setUpdatedAt(thread.updatedAt)
    hydratedRef.current = true
  }, [threadQuery.data])

  useEffect(() => {
    let cancelled = false
    void loadDraft('plot_thread', campaign.id, threadId ?? null).then((draft) => {
      if (!cancelled && draft) setDraftBanner(draft)
    })
    return () => {
      cancelled = true
    }
  }, [campaign.id, threadId])

  function buildUpdateInput(updatedAtOverride?: string): UpdatePlotThreadInput {
    return {
      updatedAt: updatedAtOverride ?? updatedAt ?? '',
      title,
      summary: summary || null,
      visibility,
      importance,
      publicContentJson: publicContent ?? undefined,
      ...(canSetGmContent ? { gmContentJson: gmContent } : {}),
      entityIds,
      tags,
    }
  }

  const autosave = useAutosave({
    resourceType: 'plot_thread',
    campaignId: campaign.id,
    resourceId: threadId ?? '',
    enabled: hydratedRef.current,
    save: (input: UpdatePlotThreadInput) =>
      plotThreadsApi.updatePlotThread(campaign.id, threadId ?? '', input),
    onSaved: (thread) => setUpdatedAt(thread.updatedAt),
  })

  useEffect(() => {
    if (!hydratedRef.current || !updatedAt) return
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    autosave.scheduleSave(buildUpdateInput())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt, title, summary, visibility, importance, publicContent, gmContent, entityIds, tags])

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
    const data = draft.data as Partial<UpdatePlotThreadInput>
    if (typeof data.title === 'string') setTitle(data.title)
    if (typeof data.summary === 'string') setSummary(data.summary)
    if (data.visibility) setVisibility(data.visibility)
    if (data.importance) setImportance(data.importance)
    if (data.publicContentJson) setPublicContent(data.publicContentJson as TiptapDoc)
    if ('gmContentJson' in data) setGmContent((data.gmContentJson as TiptapDoc) ?? null)
    if (Array.isArray(data.entityIds)) setEntityIds(data.entityIds)
    if (Array.isArray(data.tags)) setTags(data.tags)
    setDraftBanner(null)
  }

  if (threadQuery.isLoading) return <LoadingState label="Loading plot thread…" />
  if (threadQuery.isError) {
    return (
      <ErrorState
        message="This plot thread could not be loaded."
        onRetry={() => threadQuery.refetch()}
      />
    )
  }

  return (
    <section>
      <h1>Edit plot thread</h1>

      {draftBanner && (
        <div className="wb-banner">
          <p>
            You have unsaved local changes from {new Date(draftBanner.savedAt).toLocaleString()}.
          </p>
          <Button onClick={() => applyDraft(draftBanner)}>Restore</Button>
          <Button
            variant="secondary"
            onClick={() => {
              void clearDraft('plot_thread', campaign.id, threadId ?? null)
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
          <p>This plot thread was changed elsewhere.</p>
          <Button
            onClick={() => {
              hydratedRef.current = false
              autosave.resolveConflict()
              void threadQuery.refetch()
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

      <form className="wb-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <TextField
          id="title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          id="summary"
          label="Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Select
          id="visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
        />
        <Select
          id="importance"
          label="Importance"
          options={IMPORTANCE_OPTIONS}
          value={importance}
          onChange={(e) => setImportance(e.target.value as PlotThreadImportance)}
        />

        <RichTextEditor
          label="Public content"
          content={publicContent}
          onChange={setPublicContent}
          campaignId={campaign.id}
        />

        {canSetGmContent && (
          <RichTextEditor
            label="GM-only content"
            content={gmContent}
            onChange={setGmContent}
            campaignId={campaign.id}
          />
        )}

        <EntityMultiPicker
          campaignId={campaign.id}
          label="Related entities"
          value={entityIds}
          onChange={setEntityIds}
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
