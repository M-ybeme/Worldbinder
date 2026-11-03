import type {
  CampaignRole,
  EntityDetail,
  EntityRelationshipView,
  EntityVisibility,
} from '@worldbinder/contracts'
import {
  Badge,
  Button,
  Dialog,
  ErrorState,
  FormMessage,
  IconButton,
  LoadingState,
  Select,
  TextField,
  Toast,
} from '@worldbinder/ui'
import { Search, Trash2 } from 'lucide-react'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { EntityPicker } from '../../entities/components/EntityPicker'
import { ShowMoreList } from '../../entities/components/detail/ShowMore'
import { useEntityQuery, useReferencedEntities } from '../../entities/hooks/useEntities'
import { readReferences } from '../../entities/lib/entityFacts'
import { ENTITY_TYPE_LABELS } from '../../entities/lib/entityTypeIcons'
import {
  useCreateRelationshipMutation,
  useDeleteRelationshipMutation,
  useEntityBacklinksQuery,
  useEntityRelationshipsQuery,
  useRelationshipTypesQuery,
} from '../hooks/useRelationships'
import {
  allowedOtherTypes,
  endpoints,
  findDuplicate,
  findMetadataOverlap,
  relationshipChoices,
  type RelationshipChoice,
} from '../lib/relationshipChoices'
import './ConnectionsManager.css'

const UNDO_MS = 10_000
// Below this the five-column table wraps every cell; rows read better as a list.
const NARROW_QUERY = '(max-width: 1024px)'
const FILTER_THRESHOLD = 6
const MENTION_LIMIT = 9

type Removed = {
  phrase: string
  input: {
    relationshipTypeId: string
    sourceEntityId: string
    targetEntityId: string
    description?: string
    visibility: EntityVisibility
  }
}

type Notice =
  | { kind: 'removed'; removed: Removed; focusAction: boolean }
  | { kind: 'restoring'; removed: Removed }
  | { kind: 'restored'; phrase: string }
  | { kind: 'error'; message: string }

/**
 * The editor's Connections tab: the entity's relationships (managed here),
 * plus the connections it doesn't own — from its own detail fields (edited
 * on Details) and @-mentions in other entries (edited there).
 *
 * Adding works from either end: "Blackwall … Contains … The Ember & Anvil"
 * creates the stored "The Ember & Anvil — Located in → Blackwall". A
 * relationship that already exists (either way round, for symmetric types)
 * or that a detail field already states is caught before sending, and
 * explained; the API's own duplicate check (409) still has the final say,
 * including for relationships this member can't see.
 *
 * Removing applies at once and offers Undo for 10 seconds, which re-creates
 * the same type, direction, note and visibility — reported as restored only
 * once the server confirms.
 */
export function ConnectionsManager({
  campaignId,
  entity,
  metadata,
  canEdit,
  campaignRole,
  detailsUrl,
  compact,
}: {
  campaignId: string
  entity: EntityDetail
  /** The Details tab's current values (possibly not saved yet). */
  metadata: Record<string, unknown> | null
  canEdit: boolean
  campaignRole: CampaignRole
  detailsUrl: string
  /** Phones: list layout, and adding happens in a bottom sheet. */
  compact: boolean
}) {
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entity.id)
  const backlinksQuery = useEntityBacklinksQuery(campaignId, entity.id)
  const typesQuery = useRelationshipTypesQuery(campaignId)
  const deleteRelationship = useDeleteRelationshipMutation(campaignId)
  const restoreRelationship = useCreateRelationshipMutation(campaignId)
  const [filter, setFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const headingId = useId()
  const narrow = useMediaQuery(NARROW_QUERY)
  const listLayout = compact || narrow

  const worldUrl = (id: string) => `/app/campaign/${campaignId}/world/${id}`
  const thisEntity = { id: entity.id, entityType: entity.entityType, metadataJson: metadata }
  const references = readReferences(entity.entityType, metadata)
  const referenced = useReferencedEntities(
    campaignId,
    references.map((reference) => reference.entityId),
  )

  const relationships = useMemo(
    () =>
      [...(relationshipsQuery.data ?? [])].sort(
        (a, b) =>
          a.label.localeCompare(b.label) || a.otherEntity.name.localeCompare(b.otherEntity.name),
      ),
    [relationshipsQuery.data],
  )
  const needle = filter.trim().toLowerCase()
  const shown = needle
    ? relationships.filter((rel) =>
        [
          rel.label,
          rel.otherEntity.name,
          ENTITY_TYPE_LABELS[rel.otherEntity.entityType],
          rel.description ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : relationships

  const phraseFor = (rel: EntityRelationshipView) =>
    `${entity.name} ${rel.label.toLowerCase()} ${rel.otherEntity.name}`

  async function remove(rel: EntityRelationshipView, viaKeyboard: boolean) {
    setRemovingId(rel.relationshipId)
    try {
      await deleteRelationship.mutateAsync(rel.relationshipId)
      const { sourceEntityId, targetEntityId } =
        rel.direction === 'outgoing'
          ? { sourceEntityId: entity.id, targetEntityId: rel.otherEntity.id }
          : { sourceEntityId: rel.otherEntity.id, targetEntityId: entity.id }
      setNotice({
        kind: 'removed',
        focusAction: viaKeyboard,
        removed: {
          phrase: phraseFor(rel),
          input: {
            relationshipTypeId: rel.relationshipTypeId,
            sourceEntityId,
            targetEntityId,
            description: rel.description ?? undefined,
            visibility: rel.visibility,
          },
        },
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Couldn’t remove “${phraseFor(rel)}”: ${(error as Error).message}`,
      })
    } finally {
      setRemovingId(null)
    }
  }

  async function undo(removed: Removed) {
    setNotice({ kind: 'restoring', removed })
    try {
      await restoreRelationship.mutateAsync(removed.input)
      setNotice({ kind: 'restored', phrase: removed.phrase })
    } catch (error) {
      setNotice({ kind: 'error', message: restoreFailure(removed.phrase, error) })
    }
  }

  const choices = relationshipChoices(typesQuery.data ?? [], entity.entityType)
  const canSetGmOnly = campaignRole === 'owner' || campaignRole === 'gm'

  const addForm = (
    <AddRelationshipForm
      key={compact ? 'sheet' : 'inline'}
      campaignId={campaignId}
      entity={entity}
      thisEntity={thisEntity}
      choices={choices}
      typesLoading={typesQuery.isLoading}
      existing={relationships}
      canSetGmOnly={canSetGmOnly}
      detailsUrl={detailsUrl}
      worldUrl={worldUrl}
      layout={compact ? 'stacked' : 'row'}
      onAdded={(phrase) => {
        setAnnouncement(`Added: ${phrase}`)
        if (compact) setSheetOpen(false)
      }}
    />
  )

  const backlinks = backlinksQuery.data ?? []
  const derived = references.flatMap((reference) => {
    const target = referenced.entities.get(reference.entityId)
    return target ? [{ ...reference, target }] : []
  })

  return (
    <div className="wb-connections">
      <span className="wb-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>

      <section className="wb-connections__card" aria-labelledby={headingId}>
        <div className="wb-connections__head">
          <h2 id={headingId} className="wb-connections__title" tabIndex={-1}>
            Relationships{' '}
            {relationships.length > 0 && (
              <span className="wb-connections__count">{relationships.length}</span>
            )}
          </h2>
          <p className="wb-connections__hint">
            {canEdit
              ? 'Adding or removing one applies immediately and shows on both entries.'
              : 'You can view these but not change them.'}
          </p>
        </div>

        {canEdit &&
          (compact ? (
            <Button
              variant="secondary"
              className="wb-connections__add-button"
              onClick={() => setSheetOpen(true)}
            >
              Add relationship
            </Button>
          ) : (
            addForm
          ))}

        {relationships.length > FILTER_THRESHOLD && (
          <div className="wb-connections__filter">
            <Search size={16} aria-hidden="true" />
            <label className="wb-visually-hidden" htmlFor={`${headingId}-filter`}>
              Filter relationships
            </label>
            <input
              id={`${headingId}-filter`}
              type="search"
              className="wb-field__input"
              placeholder="Filter relationships"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            {needle && (
              <span className="wb-connections__muted" aria-live="polite">
                {shown.length} of {relationships.length}
              </span>
            )}
          </div>
        )}

        {relationshipsQuery.isLoading && <LoadingState label="Loading relationships…" />}
        {relationshipsQuery.isError && (
          <ErrorState
            message={relationshipsQuery.error.message}
            onRetry={() => relationshipsQuery.refetch()}
          />
        )}
        {relationshipsQuery.isSuccess && relationships.length === 0 && (
          <p className="wb-connections__empty">
            No relationships yet.
            {canEdit &&
              ' Add one to link this entry to a character, place, faction or anything else.'}
          </p>
        )}
        {relationships.length > 0 && shown.length === 0 && (
          <p className="wb-connections__empty">No relationships match “{filter.trim()}”.</p>
        )}

        {shown.length > 0 &&
          (listLayout ? (
            <ul className="wb-connections__list" aria-label={`Relationships of ${entity.name}`}>
              {shown.map((rel) => (
                <li key={rel.relationshipId} className="wb-connections__item">
                  <span className="wb-connections__item-text">
                    <span className="wb-connections__item-label">
                      {rel.label}
                      {rel.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
                    </span>
                    <Link to={worldUrl(rel.otherEntity.id)}>{rel.otherEntity.name}</Link>
                    <span className="wb-connections__muted">
                      {ENTITY_TYPE_LABELS[rel.otherEntity.entityType]}
                      {rel.description && ` · ${rel.description}`}
                    </span>
                  </span>
                  {canEdit && (
                    <RemoveButton
                      rel={rel}
                      phrase={phraseFor(rel)}
                      removing={removingId === rel.relationshipId}
                      onRemove={remove}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <table className="wb-connections__table">
              <caption className="wb-visually-hidden">Relationships of {entity.name}</caption>
              <thead>
                <tr>
                  <th scope="col">{entity.name}…</th>
                  <th scope="col">Entry</th>
                  <th scope="col">Note</th>
                  <th scope="col">Visible to</th>
                  {canEdit && (
                    <th scope="col">
                      <span className="wb-visually-hidden">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((rel) => (
                  <tr key={rel.relationshipId}>
                    <td>{rel.label}</td>
                    <td>
                      <Link to={worldUrl(rel.otherEntity.id)}>{rel.otherEntity.name}</Link>{' '}
                      <span className="wb-connections__muted">
                        · {ENTITY_TYPE_LABELS[rel.otherEntity.entityType]}
                      </span>
                    </td>
                    <td className={rel.description ? undefined : 'wb-connections__muted'}>
                      {rel.description ?? '—'}
                    </td>
                    <td>
                      {rel.visibility === 'gm_only' ? (
                        <Badge tone="warning">GM only</Badge>
                      ) : (
                        'Everyone'
                      )}
                    </td>
                    {canEdit && (
                      <td className="wb-connections__actions">
                        <RemoveButton
                          rel={rel}
                          phrase={phraseFor(rel)}
                          removing={removingId === rel.relationshipId}
                          onRemove={remove}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </section>

      {derived.length > 0 && (
        <section className="wb-connections__card" aria-labelledby={`${headingId}-details`}>
          <div className="wb-connections__head">
            <h2 id={`${headingId}-details`} className="wb-connections__title">
              From details
            </h2>
            <p className="wb-connections__hint">
              Set by this entry’s own fields, so they aren’t added or removed here.{' '}
              {canEdit && <Link to={detailsUrl}>Edit them on the Details tab</Link>}
            </p>
          </div>
          <ul className="wb-connections__plain">
            {derived.map((item) => (
              <li key={item.key}>
                <span className="wb-connections__muted">{item.factLabel}</span>
                <Link to={worldUrl(item.target.id)}>{item.target.name}</Link>
                {item.target.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {backlinks.length > 0 && (
        <section className="wb-connections__card" aria-labelledby={`${headingId}-mentions`}>
          <div className="wb-connections__head">
            <h2 id={`${headingId}-mentions`} className="wb-connections__title">
              Mentioned in <span className="wb-connections__count">{backlinks.length}</span>
            </h2>
            <p className="wb-connections__hint">
              Created by @ links to {entity.name} in other entries. Edit the link in that entry to
              change one.
            </p>
          </div>
          <ShowMoreList
            label="Mentioned in"
            className="wb-connections__plain wb-connections__plain--columns"
            items={backlinks}
            limit={MENTION_LIMIT}
            renderItem={(link) => (
              <li key={`${link.sourceEntity.id}-${link.section}`}>
                <Link to={worldUrl(link.sourceEntity.id)}>{link.sourceEntity.name}</Link>
                <span className="wb-connections__muted">
                  {ENTITY_TYPE_LABELS[link.sourceEntity.entityType]}
                  {link.section === 'gm' && ' · GM notes'}
                </span>
              </li>
            )}
          />
        </section>
      )}

      {compact && canEdit && (
        <Dialog
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Add a relationship"
          placement="sheet"
        >
          {addForm}
        </Dialog>
      )}

      {notice?.kind === 'removed' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          message={
            <>
              Removed: <strong>{notice.removed.phrase}</strong>
            </>
          }
          announcement={`Removed: ${notice.removed.phrase}. Undo is available for 10 seconds.`}
          action={{ label: 'Undo', onClick: () => void undo(notice.removed) }}
          durationMs={UNDO_MS}
          focusAction={notice.focusAction}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'restoring' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          message={`Restoring: ${notice.removed.phrase}…`}
          action={{ label: 'Restoring…', onClick: () => {}, disabled: true }}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'restored' && (
        <Toast
          restoreFocusTo={() => document.getElementById(headingId)}
          tone="success"
          message={`Restored: ${notice.phrase}`}
          durationMs={4000}
          onDismiss={() => setNotice(null)}
        />
      )}
      {notice?.kind === 'error' && (
        <Toast restoreFocusTo={() => document.getElementById(headingId)} tone="error" message={notice.message} onDismiss={() => setNotice(null)} />
      )}
    </div>
  )
}

function RemoveButton({
  rel,
  phrase,
  removing,
  onRemove,
}: {
  rel: EntityRelationshipView
  phrase: string
  removing: boolean
  onRemove: (rel: EntityRelationshipView, viaKeyboard: boolean) => void
}) {
  return (
    <IconButton
      label={removing ? `Removing: ${phrase}` : `Remove: ${phrase}`}
      className="wb-connections__remove"
      disabled={removing}
      // `detail` is 0 for a click made with the keyboard (Enter/Space).
      onClick={(event) => onRemove(rel, event.detail === 0)}
    >
      <Trash2 size={16} aria-hidden="true" />
    </IconButton>
  )
}

function restoreFailure(phrase: string, error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 409) {
    return `“${phrase}” wasn’t restored: the same relationship was added again in the meantime.`
  }
  if (status === 403) {
    return `“${phrase}” wasn’t restored: you no longer have permission to add relationships.`
  }
  if (status === 404) {
    return `“${phrase}” couldn’t be restored: one of the entries no longer exists or isn’t visible to you.`
  }
  return `“${phrase}” couldn’t be restored: ${(error as Error).message}`
}

function AddRelationshipForm({
  campaignId,
  entity,
  thisEntity,
  choices,
  typesLoading,
  existing,
  canSetGmOnly,
  detailsUrl,
  worldUrl,
  layout,
  onAdded,
}: {
  campaignId: string
  entity: EntityDetail
  thisEntity: {
    id: string
    entityType: EntityDetail['entityType']
    metadataJson: Record<string, unknown> | null
  }
  choices: { subject: RelationshipChoice[]; object: RelationshipChoice[] }
  typesLoading: boolean
  existing: EntityRelationshipView[]
  canSetGmOnly: boolean
  detailsUrl: string
  worldUrl: (id: string) => string
  layout: 'row' | 'stacked'
  onAdded: (phrase: string) => void
}) {
  const createRelationship = useCreateRelationshipMutation(campaignId)
  const [choiceValue, setChoiceValue] = useState('')
  const [otherId, setOtherId] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const formId = useId()

  const allChoices = [...choices.subject, ...choices.object]
  const choice = allChoices.find((item) => item.value === choiceValue)
  const otherQuery = useEntityQuery(campaignId, otherId)
  const other = otherQuery.data

  // Problems known before sending — each explained, none silently fixed.
  let problem: { message: string; link?: { to: string; label: string } } | null = null
  if (choice && otherId) {
    if (otherId === entity.id) {
      problem = { message: 'An entry can’t be related to itself.' }
    } else if (other) {
      const allowed = allowedOtherTypes(choice)
      const duplicate = findDuplicate(choice, entity.id, otherId, existing)
      const overlap = findMetadataOverlap(choice, thisEntity, other)
      if (allowed && !allowed.includes(other.entityType)) {
        problem = {
          message: `“${choice.label}” can only link to ${allowed
            .map((type) => ENTITY_TYPE_LABELS[type].toLowerCase())
            .join(
              ' or ',
            )} entries, and ${other.name} is a ${ENTITY_TYPE_LABELS[other.entityType].toLowerCase()}.`,
        }
      } else if (duplicate) {
        problem = {
          message:
            duplicate.label === choice.label
              ? `${entity.name} is already “${choice.label.toLowerCase()}” ${other.name}.`
              : `This is already recorded from the other side: ${entity.name} ${duplicate.label.toLowerCase()} ${other.name}.`,
        }
      } else if (overlap?.owner === 'this') {
        problem = {
          message: `${entity.name}’s ${overlap.fieldLabel} is already ${other.name}, which says the same thing. That field is edited on the Details tab.`,
          link: { to: detailsUrl, label: 'Go to Details' },
        }
      } else if (overlap?.owner === 'other') {
        problem = {
          message: `${other.name}’s ${overlap.fieldLabel} is already ${entity.name}, which says the same thing. That field is edited on ${other.name}’s Details tab.`,
          link: { to: `${worldUrl(other.id)}/edit/details`, label: `Edit ${other.name}` },
        }
      }
    }
  }

  const ready = Boolean(choice && otherId && other && !problem)
  const pending = createRelationship.isPending

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!choice || !otherId || !other || problem || submittingRef.current) return
    submittingRef.current = true
    setSubmitError(null)
    try {
      await createRelationship.mutateAsync({
        ...endpoints(choice, entity.id, otherId),
        relationshipTypeId: choice.type.id,
        description: note.trim() || undefined,
        visibility: canSetGmOnly ? visibility : undefined,
      })
      onAdded(`${entity.name} ${choice.label.toLowerCase()} ${other.name}`)
      // Keep the chosen relationship: adding several of one kind is common.
      setOtherId(undefined)
      setNote('')
    } catch (error) {
      setSubmitError((error as Error).message)
    } finally {
      submittingRef.current = false
    }
  }

  const allowed = choice ? allowedOtherTypes(choice) : null

  return (
    <form
      className={`wb-connections__form wb-connections__form--${layout}`}
      aria-label="Add a relationship"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <div className="wb-field">
        <label htmlFor={`${formId}-type`} className="wb-field__label">
          {entity.name}…
        </label>
        <select
          id={`${formId}-type`}
          className="wb-field__input"
          value={choiceValue}
          disabled={typesLoading}
          onChange={(event) => {
            setChoiceValue(event.target.value)
            setSubmitError(null)
          }}
        >
          <option value="">{typesLoading ? 'Loading…' : 'Choose a relationship…'}</option>
          <optgroup label={`${entity.name} is the subject`}>
            {choices.subject.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
          {choices.object.length > 0 && (
            <optgroup label={`${entity.name} is the object`}>
              {choices.object.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <EntityPicker
        campaignId={campaignId}
        label="Entry"
        value={otherId}
        onChange={(id) => {
          setOtherId(id)
          setSubmitError(null)
        }}
        entityType={allowed?.length === 1 ? allowed[0] : undefined}
        placeholder={
          allowed?.length === 1
            ? `Search ${ENTITY_TYPE_LABELS[allowed[0]].toLowerCase()} entries…`
            : 'Search entries…'
        }
      />
      <TextField
        id={`${formId}-note`}
        label="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="e.g. since 1271"
      />
      {canSetGmOnly && (
        <Select
          id={`${formId}-visibility`}
          label="Visible to"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as EntityVisibility)}
          options={[
            { value: 'public', label: 'Everyone' },
            { value: 'gm_only', label: 'GM only' },
          ]}
        />
      )}
      <Button type="submit" disabled={!ready || pending}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {problem && (
        <div className="wb-connections__problem" role="alert">
          <span>{problem.message}</span>
          {problem.link && <Link to={problem.link.to}>{problem.link.label}</Link>}
        </div>
      )}
      <FormMessage message={submitError} tone="error" />
    </form>
  )
}

