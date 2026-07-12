import type { EntityVisibility, PlotThreadImportance, TiptapDoc } from '@worldbinder/contracts'
import { Button, FormMessage, Select, TextField, Textarea } from '@worldbinder/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityMultiPicker } from '../../entities/components/EntityMultiPicker'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import {
  usePlotThreadQuery,
  useCreatePlotThreadMutation,
  useUpdatePlotThreadMutation,
} from '../hooks/usePlotThreads'

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

export function ThreadFormPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const isEditMode = !!threadId
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const threadQuery = usePlotThreadQuery(campaign.id, threadId)
  const createThread = useCreatePlotThreadMutation(campaign.id)
  const updateThread = useUpdatePlotThreadMutation(campaign.id, threadId ?? '')

  const canSetGmContent = campaign.role === 'owner' || campaign.role === 'gm'

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [importance, setImportance] = useState<PlotThreadImportance>('standard')
  const [publicContent, setPublicContent] = useState<TiptapDoc | null>(null)
  const [gmContent, setGmContent] = useState<TiptapDoc | null>(null)
  const [entityIds, setEntityIds] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditMode || !threadQuery.data) return
    const thread = threadQuery.data
    setTitle(thread.title)
    setSummary(thread.summary ?? '')
    setVisibility(thread.visibility)
    if (thread.importance) setImportance(thread.importance)
    setPublicContent(thread.publicContentJson)
    if ('gmContentJson' in thread) setGmContent(thread.gmContentJson ?? null)
    setEntityIds(thread.entities.map((e) => e.id))
    setUpdatedAt(thread.updatedAt)
  }, [isEditMode, threadQuery.data])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    if (isEditMode) {
      if (!updatedAt) return
      const result = await updateThread.mutateAsync({
        updatedAt,
        title,
        summary: summary || null,
        visibility,
        importance,
        publicContentJson: publicContent ?? undefined,
        ...(canSetGmContent ? { gmContentJson: gmContent } : {}),
        entityIds,
      })
      navigate(`/app/campaign/${campaign.id}/threads/${result.id}`)
      return
    }

    const result = await createThread.mutateAsync({
      title,
      summary: summary || undefined,
      visibility,
      importance,
      publicContentJson: publicContent ?? undefined,
      ...(canSetGmContent ? { gmContentJson: gmContent ?? undefined } : {}),
      entityIds,
    })
    navigate(`/app/campaign/${campaign.id}/threads/${result.id}`)
  }

  if (isEditMode && threadQuery.isLoading) return <p>Loading…</p>
  if (isEditMode && threadQuery.isError) {
    return <FormMessage message="This plot thread could not be loaded." />
  }

  const mutation = isEditMode ? updateThread : createThread

  return (
    <section>
      <h1>{isEditMode ? 'Edit plot thread' : 'New plot thread'}</h1>

      <form className="wb-form" onSubmit={(e) => void onSubmit(e)} noValidate>
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

        <FormMessage message={mutation.error?.message} />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEditMode ? 'Save changes' : 'Create plot thread'}
        </Button>
      </form>
    </section>
  )
}
