import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  PageHeader,
} from '@worldbinder/ui'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttachmentsPanel } from '../../attachments/components/AttachmentsPanel'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { EntityPlotThreadsPanel } from '../../plot-threads/components/EntityPlotThreadsPanel'
import { BacklinksPanel } from '../../relationships/components/BacklinksPanel'
import { RelatedContentPanel } from '../../relationships/components/RelatedContentPanel'
import { RevisionHistoryPanel } from '../../revisions/components/RevisionHistoryPanel'
import { ApiError } from '../../../lib/apiClient'
import { RichTextEditor } from '../components/RichTextEditor'
import {
  useDeleteEntityMutation,
  useEntityQuery,
  useEntitySessionsQuery,
  useToggleFavoriteMutation,
} from '../hooks/useEntities'
import { clearDraft } from '../lib/draftDb'
import { EntityTypeIcon } from '../lib/entityTypeIcons'
import '../entities.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const entityQuery = useEntityQuery(campaign.id, entityId)
  const sessionAppearancesQuery = useEntitySessionsQuery(campaign.id, entityId)
  const deleteEntity = useDeleteEntityMutation(campaign.id)
  const toggleFavorite = useToggleFavoriteMutation(campaign.id, entityId ?? '')
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  if (entityQuery.isLoading) return <LoadingState label="Loading entity…" />
  if (entityQuery.isError) {
    const isNotFound = entityQuery.error instanceof ApiError && entityQuery.error.status === 404
    if (isNotFound) return <EmptyState message="This entry could not be found." />
    return <ErrorState message={entityQuery.error.message} onRetry={() => entityQuery.refetch()} />
  }
  if (!entityQuery.data) return null

  const entity = entityQuery.data

  return (
    <section>
      <PageHeader
        title={
          <span className="wb-entity-header__title">
            <EntityTypeIcon type={entity.entityType} size={20} />
            {entity.name}
          </span>
        }
        meta={
          <>
            <span>{entity.entityType}</span>
            {entity.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
            {entity.tags.length > 0 && (
              <div className="wb-entity-header__tags">
                {entity.tags.map((tag) => (
                  <span key={tag} className="wb-tag-input__chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        }
        actions={
          <>
            <IconButton
              label={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className="wb-favorite-toggle"
              aria-pressed={entity.isFavorite}
              disabled={toggleFavorite.isPending}
              onClick={() => toggleFavorite.mutate(!entity.isFavorite)}
            >
              <Star
                size={18}
                fill={entity.isFavorite ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </IconButton>
            {canManage && (
              <>
                <Link
                  className="wb-button wb-button--secondary"
                  to={`/app/campaign/${campaign.id}/world/${entity.id}/edit`}
                >
                  Edit
                </Link>
                <Button
                  variant="secondary"
                  disabled={deleteEntity.isPending}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />

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
              void clearDraft(campaign.id, entity.id)
              navigate(`/app/campaign/${campaign.id}/world`)
            },
          })
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <div className="wb-entity-detail">
        <div className="wb-entity-detail__main">
          {entity.summary && <p>{entity.summary}</p>}

          <RichTextEditor
            label="Content"
            content={entity.publicContentJson}
            editable={false}
            campaignId={campaign.id}
          />

          {'gmContentJson' in entity && (
            <RichTextEditor
              label="GM-only content"
              content={entity.gmContentJson ?? null}
              editable={false}
              campaignId={campaign.id}
            />
          )}
        </div>

        <aside className="wb-entity-detail__rail">
          <RelatedContentPanel
            campaignId={campaign.id}
            entityId={entity.id}
            canEdit={canManage}
            campaignRole={campaign.role}
          />

          <EntityPlotThreadsPanel campaignId={campaign.id} entityId={entity.id} />

          <div className="wb-related-content">
            <div>
              <h2>Session Appearances</h2>
              {sessionAppearancesQuery.data?.length === 0 && <p>No session appearances yet.</p>}
              <ul className="wb-relationship-list">
                {sessionAppearancesQuery.data?.map((session) => (
                  <li key={session.id}>
                    <Link to={`/app/campaign/${campaign.id}/sessions/${session.id}`}>
                      Session {session.sessionNumber}: {session.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <AttachmentsPanel
            campaignId={campaign.id}
            resourceType="entity"
            resourceId={entity.id}
            canManage={canManage}
          />

          <BacklinksPanel campaignId={campaign.id} entityId={entity.id} />

          <RevisionHistoryPanel
            campaignId={campaign.id}
            resourceType="entity"
            resourceId={entity.id}
            canRestore={canManage}
            onRestored={() => void entityQuery.refetch()}
          />
        </aside>
      </div>
    </section>
  )
}
