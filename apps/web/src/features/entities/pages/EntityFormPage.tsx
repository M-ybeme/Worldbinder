import type {
  EntityDetail,
  EntityStatus,
  EntityType,
  EntityVisibility,
  TiptapDoc,
} from '@worldbinder/contracts'
import type { UpdateEntityInput } from '@worldbinder/validation'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  TagInput,
  TextField,
  Textarea,
} from '@worldbinder/ui'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AttachmentsPanel } from '../../attachments/components/AttachmentsPanel'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { ConnectionsManager } from '../../relationships/components/ConnectionsManager'
import { clearDraft, loadDraft, type ResourceDraft } from '../../../lib/draftDb'
import { useAutosave } from '../../../lib/useAutosave'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import * as entitiesApi from '../api/entitiesApi'
import { EntityBreadcrumbs } from '../components/detail/EntityBreadcrumbs'
import { EditorSafetyPanels } from '../../editing/EditorSafetyPanels'
import { SaveStatusIndicator } from '../../editing/SaveStatusIndicator'
import { useEditorSafety } from '../../editing/useEditorSafety'
import { EntityMetadataFields } from '../components/EntityMetadataFields'
import { RichTextEditor } from '../components/RichTextEditor'
import { useEntityQuery } from '../hooks/useEntities'
import { entityDifferences } from '../lib/entityConflict'
import { ENTITY_TYPE_LABELS, EntityTypeIcon } from '../lib/entityTypeIcons'
import '../components/detail/entityDetail.css'
import '../components/editor/entityEditor.css'

export const EDITOR_TABS = ['content', 'details', 'connections', 'files'] as const
export type EditorTab = (typeof EDITOR_TABS)[number]

const TAB_LABELS: Record<EditorTab, string> = {
  content: 'Content',
  details: 'Details',
  connections: 'Connections',
  files: 'Files',
}

// Same role set as the article page's Edit action; the API enforces it.
const EDIT_ROLES = new Set(['owner', 'gm', 'editor'])
// Matches the shell's phone breakpoint (bottom tabs).
const PHONE_QUERY = '(max-width: 768px)'

const ENTITY_TYPE_OPTIONS = (Object.keys(ENTITY_TYPE_LABELS) as EntityType[]).map((value) => ({
  value,
  label: ENTITY_TYPE_LABELS[value],
}))

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

/** `/world/:id/edit` (the pre-tabs URL) → the Content tab. */
export function EntityEditRedirect() {
  return <Navigate to="content" replace />
}

/**
 * The entity editor (Design D, Stage 2 foundation): one page under
 * `/world/:id/edit/:tab` with Content, Details, Connections and Files tabs.
 *
 * This component owns all of the entity's form state and the single
 * `useAutosave` lifecycle, so switching tabs changes only the URL — it
 * never remounts this component, re-hydrates fields, or starts another
 * autosave. Content and Details stay mounted (hidden when inactive) so
 * rich-text documents and field values are never reset; Connections and
 * Files mount when opened and save through their own endpoints, which
 * don't touch the entity's `updatedAt`, so they can't cause a false
 * conflict for the autosave.
 */
export function EntityFormPage() {
  const { entityId, tab: tabParam } = useParams<{ entityId: string; tab: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const canEdit = EDIT_ROLES.has(campaign.role)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const tab = (EDITOR_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as EditorTab)
    : null

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
    enabled: hydratedRef.current && canEdit,
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

  /** The save payload for the server's version — used as the new baseline
   * when the user loads it, so showing it doesn't trigger a save. Mirrors
   * `buildUpdateInput`. */
  function inputFromServer(server: EntityDetail): UpdateEntityInput {
    return {
      entityType: server.entityType,
      updatedAt: server.updatedAt,
      name: server.name,
      summary: server.summary || undefined,
      tags: server.tags,
      aliases: server.aliases,
      visibility: server.visibility,
      status: server.status,
      metadata: (server.metadataJson as Record<string, unknown> | null) ?? {},
      publicContentJson: server.publicContentJson ?? undefined,
      ...('gmContentJson' in server ? { gmContentJson: server.gmContentJson ?? null } : {}),
    } as UpdateEntityInput
  }

  const articleUrl = `/app/campaign/${campaign.id}/world/${entityId}`
  const editBase = `${articleUrl}/edit`

  // Every way out of the editor (links, Back/Forward, View article,
  // campaign switch) is guarded; tab switches aren't. Conflict resolution
  // re-saves against exactly the version reviewed.
  const safety = useEditorSafety({
    autosave,
    isWithinEditor: (pathname) => pathname === editBase || pathname.startsWith(`${editBase}/`),
    fetchServer: useCallback(
      () => entitiesApi.getEntity(campaign.id, entityId ?? ''),
      [campaign.id, entityId],
    ),
    applyKeepMine: (server: EntityDetail) => {
      skipNextAutosaveRef.current = true
      setUpdatedAt(server.updatedAt)
      autosave.scheduleSave(buildUpdateInput(server.updatedAt))
    },
    applyServer: (server: EntityDetail) => {
      setName(server.name)
      setSummary(server.summary ?? '')
      setTags(server.tags)
      setAliases(server.aliases)
      setVisibility(server.visibility)
      setStatus(server.status)
      setMetadata((server.metadataJson as Record<string, unknown> | null) ?? {})
      setPublicContent(server.publicContentJson)
      setHasGmAccess('gmContentJson' in server)
      setGmContent('gmContentJson' in server ? (server.gmContentJson ?? null) : null)
      setUpdatedAt(server.updatedAt)
      setFormKey((key) => key + 1)
      setDraftBanner(null)
      return inputFromServer(server)
    },
  })
  const { guard } = safety

  // Unknown tab names (and the bare /edit URL, via EntityEditRedirect)
  // resolve to Content. Same route, so this doesn't remount the editor.
  if (!tab) return <Navigate to={`${articleUrl}/edit/content`} replace />

  if (entityQuery.isLoading) return <LoadingState label="Loading entry…" />
  if (entityQuery.isError || !entityQuery.data) {
    return (
      <ErrorState message="This entry could not be loaded." onRetry={() => entityQuery.refetch()} />
    )
  }
  if (!canEdit) {
    return (
      <EmptyState
        message="You don’t have permission to edit this entry."
        action={
          <Link className="wb-button wb-button--secondary" to={articleUrl}>
            View the article
          </Link>
        }
      />
    )
  }

  const displayName = name.trim() || entityQuery.data.name

  return (
    <div className="wb-ed wb-edit">
      <header className="wb-ed-header">
        <EntityBreadcrumbs
          campaignId={campaign.id}
          entityId={entityQuery.data.id}
          entityType={entityType}
          name={displayName}
          editing
        />
        <div className="wb-ed-header__row">
          <div className="wb-ed-header__identity">
            <div className="wb-ed-header__name">
              <span className="wb-ed-type-tile" aria-hidden="true">
                <EntityTypeIcon type={entityType} size={20} />
              </span>
              <h1>
                <span className="wb-visually-hidden">Editing </span>
                {displayName}
              </h1>
            </div>
            <div className="wb-ed-header__meta">
              <span>{ENTITY_TYPE_LABELS[entityType]}</span>
              <SaveStatusIndicator
                status={autosave.status}
                onRetry={() => void autosave.retry()}
                onReview={safety.conflict.openConflict}
              />
            </div>
          </div>
          <div className="wb-ed-header__actions">
            <Button
              variant="secondary"
              disabled={guard.busy}
              onClick={() => navigate(articleUrl)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              View article
            </Button>
          </div>
        </div>
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
              void clearDraft('entity', campaign.id, entityId ?? null)
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
        recordNoun="entry"
        describe={(server: EntityDetail) => ({
          name: server.name,
          updatedAt: server.updatedAt,
          differences: entityDifferences(
            {
              entityType,
              name,
              summary,
              aliases,
              tags,
              visibility,
              status,
              metadata,
              publicContent,
              ...(hasGmAccess ? { gmContent } : {}),
            },
            server,
          ),
        })}
      />

      <nav className="wb-edit-tabs" aria-label="Editor sections">
        {EDITOR_TABS.map((value) => (
          <NavLink
            key={value}
            to={`${articleUrl}/edit/${value}`}
            className={({ isActive }) =>
              ['wb-edit-tabs__tab', isActive ? 'wb-edit-tabs__tab--active' : '']
                .filter(Boolean)
                .join(' ')
            }
          >
            {TAB_LABELS[value]}
          </NavLink>
        ))}
      </nav>

      <form
        className="wb-edit-panels"
        onSubmit={(event) => event.preventDefault()}
        noValidate
        aria-label={`Edit ${displayName}`}
      >
        <section
          className="wb-edit-panel wb-edit-panel--content"
          hidden={tab !== 'content'}
          aria-label="Content"
        >
          <Textarea
            id="summary"
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
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
        </section>

        <section className="wb-edit-panel" hidden={tab !== 'details'} aria-label="Details">
          <div className="wb-form wb-form--wide">
            <TextField
              id="name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              id="entityType"
              label="Type"
              options={ENTITY_TYPE_OPTIONS}
              value={entityType}
              disabled
              onChange={(e) => setEntityType(e.target.value as EntityType)}
            />
            <p className="wb-field__hint wb-edit-hint">
              An entry’s type is set when it’s created and can’t be changed.
            </p>
            <TagInput label="Aliases" value={aliases} onChange={setAliases} />
            <TagInput label="Tags" value={tags} onChange={setTags} />
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
            <fieldset className="wb-edit-fieldset">
              <legend>{ENTITY_TYPE_LABELS[entityType]} details</legend>
              <EntityMetadataFields
                campaignId={campaign.id}
                entityType={entityType}
                value={metadata}
                onChange={setMetadata}
              />
            </fieldset>
          </div>
        </section>
      </form>

      {tab === 'connections' && (
        <section className="wb-edit-panel wb-edit-panel--wide" aria-label="Connections">
          <ConnectionsManager
            campaignId={campaign.id}
            entity={entityQuery.data}
            metadata={metadata}
            canEdit={canEdit}
            campaignRole={campaign.role}
            detailsUrl={`${articleUrl}/edit/details`}
            compact={isPhone}
          />
        </section>
      )}

      {tab === 'files' && (
        <section className="wb-edit-panel" aria-label="Files">
          <AttachmentsPanel
            campaignId={campaign.id}
            resourceType="entity"
            resourceId={entityQuery.data.id}
            canManage={canEdit}
          />
        </section>
      )}
    </div>
  )
}
