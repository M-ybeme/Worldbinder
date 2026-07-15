import { Button, EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttachmentsPanel } from '../../attachments/components/AttachmentsPanel'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { RelatedContentPanel } from '../../relationships/components/RelatedContentPanel'
import { RevisionHistoryPanel } from '../../revisions/components/RevisionHistoryPanel'
import { ApiError } from '../../../lib/apiClient'
import { RichTextEditor } from '../components/RichTextEditor'
import {
  useDeleteEntityMutation,
  useEntityQuery,
  useEntitySessionsQuery,
} from '../hooks/useEntities'
import { clearDraft } from '../lib/draftDb'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const entityQuery = useEntityQuery(campaign.id, entityId)
  const sessionAppearancesQuery = useEntitySessionsQuery(campaign.id, entityId)
  const deleteEntity = useDeleteEntityMutation(campaign.id)
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

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
      <header className="wb-entity-header">
        <h1>{entity.name}</h1>
        <span className="wb-entity-header__meta">
          {entity.entityType}
          {entity.visibility === 'gm_only' ? ' · GM only' : ''}
        </span>
        {entity.tags.length > 0 && (
          <div className="wb-entity-header__tags">
            {entity.tags.map((tag) => (
              <span key={tag} className="wb-tag-input__chip">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {canManage && (
        <div className="wb-entity-header__actions">
          <Link
            className="wb-button wb-button--secondary"
            to={`/app/campaign/${campaign.id}/world/${entity.id}/edit`}
          >
            Edit
          </Link>
          <Button
            variant="secondary"
            disabled={deleteEntity.isPending}
            onClick={() => {
              if (!window.confirm(`Delete "${entity.name}"? This cannot be undone.`)) return
              deleteEntity.mutate(entity.id, {
                onSuccess: () => {
                  void clearDraft(campaign.id, entity.id)
                  navigate(`/app/campaign/${campaign.id}/world`)
                },
              })
            }}
          >
            Delete
          </Button>
        </div>
      )}

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

      <RelatedContentPanel
        campaignId={campaign.id}
        entityId={entity.id}
        canEdit={canManage}
        campaignRole={campaign.role}
      />

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

      <RevisionHistoryPanel
        campaignId={campaign.id}
        resourceType="entity"
        resourceId={entity.id}
        canRestore={canManage}
        onRestored={() => void entityQuery.refetch()}
      />
    </section>
  )
}
