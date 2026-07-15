import type { CampaignRole, EntityRelationshipView, EntityVisibility } from '@worldbinder/contracts'
import { Button, EmptyState, ErrorState, FormMessage, LoadingState, Select } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EntityPicker } from '../../entities/components/EntityPicker'
import {
  useCreateRelationshipMutation,
  useDeleteRelationshipMutation,
  useEntityBacklinksQuery,
  useEntityRelationshipsQuery,
  useRelationshipTypesQuery,
} from '../hooks/useRelationships'

export interface RelatedContentPanelProps {
  campaignId: string
  entityId: string
  canEdit: boolean
  campaignRole: CampaignRole
}

/**
 * Combines relationships (outgoing/incoming) and wiki-link backlinks into
 * one "related content" section on the entity detail page — the roadmap's
 * "start on any page and discover related information" principle.
 */
export function RelatedContentPanel({
  campaignId,
  entityId,
  canEdit,
  campaignRole,
}: RelatedContentPanelProps) {
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entityId)
  const backlinksQuery = useEntityBacklinksQuery(campaignId, entityId)
  const typesQuery = useRelationshipTypesQuery(campaignId)
  const createRelationship = useCreateRelationshipMutation(campaignId)
  const deleteRelationship = useDeleteRelationshipMutation(campaignId)

  // Mirrors EntityFormPage's own simplification: an editor's GM-content
  // visibility depends on a per-member flag the frontend doesn't have in
  // context here, so only owner/GM get the gm_only option — same
  // conservative default as the entity form.
  const canSetGmOnly = campaignRole === 'owner' || campaignRole === 'gm'

  const [showForm, setShowForm] = useState(false)
  const [relationshipTypeId, setRelationshipTypeId] = useState('')
  const [targetEntityId, setTargetEntityId] = useState<string | undefined>(undefined)
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')

  const relationships = relationshipsQuery.data ?? []
  const outgoing = relationships.filter((r) => r.direction === 'outgoing')
  const incoming = relationships.filter((r) => r.direction === 'incoming')
  const backlinks = backlinksQuery.data ?? []

  async function handleCreate() {
    if (!relationshipTypeId || !targetEntityId) return
    await createRelationship.mutateAsync({
      sourceEntityId: entityId,
      targetEntityId,
      relationshipTypeId,
      description: description || undefined,
      visibility: canSetGmOnly ? visibility : undefined,
    })
    setShowForm(false)
    setRelationshipTypeId('')
    setTargetEntityId(undefined)
    setDescription('')
    setVisibility('public')
  }

  function renderRelationship(rel: EntityRelationshipView) {
    return (
      <li key={rel.relationshipId}>
        {rel.label}{' '}
        <Link to={`/app/campaign/${campaignId}/world/${rel.otherEntity.id}`}>
          {rel.otherEntity.name}
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={() => deleteRelationship.mutate(rel.relationshipId)}
            aria-label={`Remove relationship with ${rel.otherEntity.name}`}
          >
            ×
          </button>
        )}
      </li>
    )
  }

  return (
    <section className="wb-related-content">
      <div>
        <h2>Relationships</h2>

        {canEdit && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            + Relationship
          </Button>
        )}

        {showForm && (
          <div className="wb-form">
            <Select
              id="relationship-type"
              label="Relationship type"
              value={relationshipTypeId}
              onChange={(e) => setRelationshipTypeId(e.target.value)}
              options={[
                { value: '', label: 'Select a type…' },
                ...(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.forwardLabel })),
              ]}
            />
            <EntityPicker
              campaignId={campaignId}
              label="Target entity"
              value={targetEntityId}
              onChange={setTargetEntityId}
            />
            {canSetGmOnly && (
              <Select
                id="relationship-visibility"
                label="Visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
                options={[
                  { value: 'public', label: 'Public — visible to all campaign members' },
                  { value: 'gm_only', label: 'GM only — hidden from players' },
                ]}
              />
            )}
            <FormMessage message={createRelationship.error?.message ?? null} tone="error" />
            <div className="wb-entity-header__actions">
              <Button
                onClick={() => void handleCreate()}
                disabled={!relationshipTypeId || !targetEntityId || createRelationship.isPending}
              >
                Save
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {relationshipsQuery.isLoading && <LoadingState label="Loading relationships…" />}
        {relationshipsQuery.isError && (
          <ErrorState
            message={relationshipsQuery.error.message}
            onRetry={() => relationshipsQuery.refetch()}
          />
        )}
        {!relationshipsQuery.isLoading &&
          !relationshipsQuery.isError &&
          relationships.length === 0 &&
          !showForm && <EmptyState message="No relationships yet." />}

        {outgoing.length > 0 && (
          <>
            <h3>Outgoing</h3>
            <ul className="wb-relationship-list">{outgoing.map(renderRelationship)}</ul>
          </>
        )}

        {incoming.length > 0 && (
          <>
            <h3>Incoming</h3>
            <ul className="wb-relationship-list">{incoming.map(renderRelationship)}</ul>
          </>
        )}
      </div>

      <div>
        <h2>Backlinks</h2>
        {backlinksQuery.isLoading && <LoadingState label="Loading backlinks…" />}
        {backlinksQuery.isError && (
          <ErrorState
            message={backlinksQuery.error.message}
            onRetry={() => backlinksQuery.refetch()}
          />
        )}
        {!backlinksQuery.isLoading && !backlinksQuery.isError && backlinks.length === 0 && (
          <EmptyState message="No backlinks yet." />
        )}
        {!backlinksQuery.isLoading && !backlinksQuery.isError && backlinks.length > 0 && (
          <ul className="wb-backlink-list">
            {backlinks.map((link) => (
              <li key={`${link.sourceEntity.id}-${link.section}`}>
                <Link to={`/app/campaign/${campaignId}/world/${link.sourceEntity.id}`}>
                  {link.sourceEntity.name}
                </Link>
                {link.section === 'gm' ? ' (GM only)' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
