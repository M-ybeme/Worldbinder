import { Badge, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { ApiError } from '../../../lib/apiClient'
import { clearDraft } from '../../../lib/draftDb'
import { tiptapToPlainText } from '../../../lib/tiptapText'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { RichTextEditor } from '../components/RichTextEditor'
import { ConnectionsPanel } from '../components/detail/ConnectionsPanel'
import { EntityHeader } from '../components/detail/EntityHeader'
import { FactsStrip } from '../components/detail/FactsStrip'
import {
  AppearsInPanel,
  EntityThreadsPanel,
  FilesAndHistoryPanels,
} from '../components/detail/RelatedPanels'
import {
  useDeleteEntityMutation,
  useEntityQuery,
  useReferencedEntities,
  useToggleFavoriteMutation,
} from '../hooks/useEntities'
import { readFacts, readReferences } from '../lib/entityFacts'
import '../entities.css'
import '../components/detail/entityDetail.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])
// Phones: a compact connections preview sits under the summary and facts,
// ahead of the article, and the remaining panels collapse into disclosures
// (Design D's mobile article view).
const PHONE_QUERY = '(max-width: 768px)'

/**
 * An entity's article page (Design D, Stage 1 — viewing). The article
 * (summary, facts, public text, GM-only notes) leads; connected
 * information sits in a side column: connections, plot threads, session
 * appearances, files and revision history. Editing happens in the tabbed
 * editor at `/edit/:tab` (EntityFormPage).
 *
 * Every panel reads through an endpoint that applies the API's visibility
 * rules; `gmContentJson` is present on the entity only when the caller may
 * see it. Nothing here hides data the API sent — it only decides layout.
 */
export function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)

  const entityQuery = useEntityQuery(campaign.id, entityId)
  const entity = entityQuery.data
  const references = entity ? readReferences(entity.entityType, entity.metadataJson) : []
  const referenced = useReferencedEntities(
    campaign.id,
    references.map((reference) => reference.entityId),
  )
  const deleteEntity = useDeleteEntityMutation(campaign.id)
  const toggleFavorite = useToggleFavoriteMutation(campaign.id, entityId ?? '')
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [status, setStatus] = useState('')

  if (entityQuery.isLoading) return <LoadingState label="Loading entry…" />
  if (entityQuery.isError) {
    const isNotFound = entityQuery.error instanceof ApiError && entityQuery.error.status === 404
    if (isNotFound) {
      // Also what a member sees for an entry they aren't allowed to view —
      // the API answers 404 rather than confirming it exists.
      return (
        <EmptyState
          message="This entry could not be found. It may have been deleted, or it isn’t shared with you."
          action={
            <Link className="wb-button wb-button--secondary" to={`/app/campaign/${campaign.id}/world`}>
              Back to World
            </Link>
          }
        />
      )
    }
    return <ErrorState message={entityQuery.error.message} onRetry={() => entityQuery.refetch()} />
  }
  if (!entity) return null

  const facts = readFacts(entity.entityType, entity.metadataJson)
  const hasPublicText = tiptapToPlainText(entity.publicContentJson) !== ''
  const gmNotes = 'gmContentJson' in entity ? (entity.gmContentJson ?? null) : null
  const hasGmNotes = tiptapToPlainText(gmNotes) !== ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus('Link copied.')
    } catch {
      setStatus('Couldn’t copy the link — copy it from the address bar instead.')
    }
  }

  const connections = (
    <ConnectionsPanel
      campaignId={campaign.id}
      entity={entity}
      references={references}
      resolved={referenced.entities}
      canEdit={canManage}
      campaignRole={campaign.role}
      compact={isPhone}
    />
  )

  return (
    <div className="wb-ed">
      <EntityHeader
        campaignId={campaign.id}
        entity={entity}
        hasGmNotes={hasGmNotes}
        canManage={canManage}
        favoritePending={toggleFavorite.isPending}
        onToggleFavorite={() => toggleFavorite.mutate(!entity.isFavorite)}
        onCopyLink={() => void copyLink()}
        onDelete={() => setConfirmDeleteOpen(true)}
      />
      <p className="wb-visually-hidden" role="status">
        {status}
      </p>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete "${entity.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteEntity.isPending}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          deleteEntity.mutate(entity.id, {
            onSuccess: () => {
              void clearDraft('entity', campaign.id, entity.id)
              navigate(`/app/campaign/${campaign.id}/world`)
            },
          })
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <div className="wb-ed-layout">
        <article className="wb-ed-article" aria-label={entity.name}>
          {entity.summary && <p className="wb-ed-lede">{entity.summary}</p>}
          <FactsStrip
            campaignId={campaign.id}
            facts={facts}
            references={references}
            resolved={referenced.entities}
          />
          {isPhone && connections}

          {hasPublicText ? (
            <div className="wb-ed-prose">
              <RichTextEditor
                label="Content"
                content={entity.publicContentJson}
                editable={false}
                campaignId={campaign.id}
                presentation="article"
              />
            </div>
          ) : (
            !entity.summary && (
              <p className="wb-ed-muted wb-ed-empty-article">
                Nothing has been written about {entity.name} yet.
                {canManage && (
                  <>
                    {' '}
                    <Link to={`/app/campaign/${campaign.id}/world/${entity.id}/edit/content`}>
                      Start writing
                    </Link>
                  </>
                )}
              </p>
            )
          )}

          {hasGmNotes && (
            <section className="wb-ed-gm" aria-labelledby="wb-ed-gm-title">
              <div className="wb-ed-gm__head">
                <h2 id="wb-ed-gm-title">GM-only notes</h2>
                <Badge tone="warning">Hidden from players</Badge>
              </div>
              <div className="wb-ed-prose">
                <RichTextEditor
                  label="GM-only notes"
                  content={gmNotes}
                  editable={false}
                  campaignId={campaign.id}
                  presentation="article"
                />
              </div>
            </section>
          )}
        </article>

        <aside className="wb-ed-aside" aria-label={`Connected to ${entity.name}`}>
          {!isPhone && connections}
          <EntityThreadsPanel campaignId={campaign.id} entityId={entity.id} collapsible={isPhone} />
          <AppearsInPanel campaignId={campaign.id} entityId={entity.id} collapsible={isPhone} />
          <FilesAndHistoryPanels
            campaignId={campaign.id}
            entity={entity}
            canManage={canManage}
            onRestored={() => void entityQuery.refetch()}
          />
        </aside>
      </div>
    </div>
  )
}
