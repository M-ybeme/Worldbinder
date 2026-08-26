import type { CampaignRole, EntityRelationshipView, EntityVisibility } from '@worldbinder/contracts'
import { Button, EmptyState, ErrorState, FormMessage, LoadingState, Select } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EntityPicker } from '../../entities/components/EntityPicker'
import {
  useCreateRelationshipMutation,
  useDeleteRelationshipMutation,
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
 * Outgoing/incoming relationships for the entity detail page's rail —
 * the roadmap's "start on any page and discover related information"
 * principle. Backlinks used to render here too; split into its own
 * BacklinksPanel so the rail can position it after Attachments, matching
 * docs/planning/ui-ux.md's specified section order.
 */
export function RelatedContentPanel({
  campaignId,
  entityId,
  canEdit,
  campaignRole,
}: RelatedContentPanelProps) {
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entityId)
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
    <div className="wb-related-content">
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
                {createRelationship.isPending ? 'Saving…' : 'Save'}
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
    </div>
  )
}
