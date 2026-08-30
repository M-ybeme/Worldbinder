import type { EntityStatus, EntityType, EntityVisibility, TiptapDoc } from '@worldbinder/contracts'
import type { UpdateEntityInput } from '@worldbinder/validation'
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
import * as entitiesApi from '../api/entitiesApi'
import { EntityMetadataFields } from '../components/EntityMetadataFields'
import { RichTextEditor } from '../components/RichTextEditor'
import { useEntityQuery } from '../hooks/useEntities'

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'character', label: 'Character' },
  { value: 'location', label: 'Location' },
  { value: 'faction', label: 'Faction' },
  { value: 'organization', label: 'Organization' },
  { value: 'item', label: 'Item' },
  { value: 'deity', label: 'Deity' },
  { value: 'creature', label: 'Creature' },
  { value: 'event', label: 'Event' },
  { value: 'quest', label: 'Quest' },
  { value: 'lore', label: 'Lore' },
  { value: 'custom', label: 'Custom' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

const SAVE_STATUS_TEXT: Record<string, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  offline: 'Offline — changes saved locally',
  error: 'Save failed — changes saved locally',
}

export function EntityFormPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { campaign } = useCampaignOutletContext()

  const entityQuery = useEntityQuery(campaign.id, entityId)

  const [entityType, setEntityType] = useState<EntityType>('character')
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [aliases, setAliases] = useState<string[]>([])
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [status, setStatus] = useState<EntityStatus>('draft')
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})
  const [publicContent, setPublicContent] = useState<TiptapDoc | null>(null)
  const [gmContent, setGmContent] = useState<TiptapDoc | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [hasGmAccess, setHasGmAccess] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [draftBanner, setDraftBanner] = useState<ResourceDraft | null>(null)

  const hydratedRef = useRef(false)
  const skipNextAutosaveRef = useRef(true)

  useEffect(() => {
    if (!entityQuery.data || hydratedRef.current) return
    const entity = entityQuery.data
    setEntityType(entity.entityType)
    setName(entity.name)
    setSummary(entity.summary ?? '')
    setTags(entity.tags)
    setAliases(entity.aliases)
    setVisibility(entity.visibility)
    setStatus(entity.status)
    setMetadata((entity.metadataJson as Record<string, unknown> | null) ?? {})
    setPublicContent(entity.publicContentJson)
    setUpdatedAt(entity.updatedAt)
    if ('gmContentJson' in entity) {
      setHasGmAccess(true)
      setGmContent(entity.gmContentJson ?? null)
    }
    hydratedRef.current = true
    setFormKey((key) => key + 1)
  }, [entityQuery.data])

  useEffect(() => {
    let cancelled = false
    void loadDraft('entity', campaign.id, entityId ?? null).then((draft) => {
      if (!cancelled && draft) setDraftBanner(draft)
    })
    return () => {
      cancelled = true
    }
  }, [campaign.id, entityId])

  function buildUpdateInput(updatedAtOverride?: string): UpdateEntityInput {
    return {
      entityType,
      updatedAt: updatedAtOverride ?? updatedAt ?? '',
      name,
      summary: summary || undefined,
      tags,
      aliases,
      visibility,
      status,
      metadata,
      publicContentJson: publicContent ?? undefined,
      ...(hasGmAccess ? { gmContentJson: gmContent } : {}),
    } as UpdateEntityInput
  }

  const autosave = useAutosave({
    resourceType: 'entity',
    campaignId: campaign.id,
    resourceId: entityId ?? '',
    enabled: hydratedRef.current,
    save: (input: UpdateEntityInput) =>
      entitiesApi.updateEntity(campaign.id, entityId ?? '', input),
    onSaved: (entity) => setUpdatedAt(entity.updatedAt),
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
    entityType,
    name,
    summary,
    tags,
    aliases,
    visibility,
    status,
    metadata,
    publicContent,
    gmContent,
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
    const data = draft.data as Partial<UpdateEntityInput> & {
      metadata?: Record<string, unknown>
    }
    if (typeof data.name === 'string') setName(data.name)
    if (typeof data.summary === 'string') setSummary(data.summary)
    if (Array.isArray(data.tags)) setTags(data.tags)
    if (Array.isArray(data.aliases)) setAliases(data.aliases)
    if (data.visibility) setVisibility(data.visibility)
    if (data.status) setStatus(data.status)
    if (data.metadata) setMetadata(data.metadata)
    if (data.publicContentJson) setPublicContent(data.publicContentJson as TiptapDoc)
    if ('gmContentJson' in data) setGmContent((data.gmContentJson as TiptapDoc) ?? null)
    setFormKey((key) => key + 1)
    setDraftBanner(null)
  }

  if (entityQuery.isLoading) return <LoadingState label="Loading entity…" />
  if (entityQuery.isError) {
    return (
      <ErrorState message="This entry could not be loaded." onRetry={() => entityQuery.refetch()} />
    )
  }

  return (
    <section>
      <h1>Edit entity</h1>

      {draftBanner && (
        <div className="wb-banner">
          <p>
            You have unsaved local changes from {new Date(draftBanner.savedAt).toLocaleString()}.
          </p>
          <Button onClick={() => applyDraft(draftBanner)}>Restore</Button>
          <Button
            variant="secondary"
            onClick={() => {
              void clearDraft('entity', campaign.id, entityId ?? null)
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
          <p>This entry was changed elsewhere.</p>
          <Button
            onClick={() => {
              hydratedRef.current = false
              autosave.resolveConflict()
              void entityQuery.refetch()
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
        <Select
          id="entityType"
          label="Type"
          options={ENTITY_TYPE_OPTIONS}
          value={entityType}
          disabled
          onChange={(e) => setEntityType(e.target.value as EntityType)}
        />
        <TextField
          id="name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Textarea
          id="summary"
          label="Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <TagInput label="Tags" value={tags} onChange={setTags} />
        <TagInput label="Aliases" value={aliases} onChange={setAliases} />
        <Select
          id="visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
        />
        <Select
          id="status"
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as EntityStatus)}
        />

        <EntityMetadataFields
          campaignId={campaign.id}
          entityType={entityType}
          value={metadata}
          onChange={setMetadata}
        />

        <RichTextEditor
          key={`public-${formKey}`}
          label="Public content"
          content={publicContent}
          onChange={setPublicContent}
          campaignId={campaign.id}
        />

        {hasGmAccess && (
          <div className="wb-gm-content">
            <RichTextEditor
              key={`gm-${formKey}`}
              label="GM-only content"
              content={gmContent}
              onChange={setGmContent}
              campaignId={campaign.id}
            />
          </div>
        )}
      </form>
    </section>
  )
}
