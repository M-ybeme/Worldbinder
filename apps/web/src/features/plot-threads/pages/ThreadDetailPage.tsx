import { Button, FormMessage } from '@worldbinder/ui'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { useDeletePlotThreadMutation, usePlotThreadQuery } from '../hooks/usePlotThreads'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const threadQuery = usePlotThreadQuery(campaign.id, threadId)
  const deleteThread = useDeletePlotThreadMutation(campaign.id)
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

  if (threadQuery.isLoading) return <p>Loading…</p>
  if (threadQuery.isError || !threadQuery.data) {
    return <FormMessage message="This plot thread could not be found." />
  }

  const thread = threadQuery.data

  return (
    <section>
      <header className="wb-entity-header">
        <h1>{thread.title}</h1>
        <span className="wb-entity-header__meta">
          {thread.status ?? thread.playerFacingStatus}
          {thread.importance ? ` · ${thread.importance}` : ''}
          {thread.visibility === 'gm_only' ? ' · GM only' : ''}
          {thread.neglected ? ' · Neglected' : ''}
        </span>
      </header>

      {canManage && (
        <div className="wb-entity-header__actions">
          <Link
            className="wb-button wb-button--secondary"
            to={`/app/campaign/${campaign.id}/threads/${thread.id}/edit`}
          >
            Edit
          </Link>
          <Button
            variant="secondary"
            disabled={deleteThread.isPending}
            onClick={() => {
              if (!window.confirm(`Delete "${thread.title}"? This cannot be undone.`)) return
              deleteThread.mutate(thread.id, {
                onSuccess: () => navigate(`/app/campaign/${campaign.id}/threads`),
              })
            }}
          >
            Delete
          </Button>
        </div>
      )}

      {thread.summary && <p>{thread.summary}</p>}

      <RichTextEditor
        label="Content"
        content={thread.publicContentJson}
        editable={false}
        campaignId={campaign.id}
      />

      {'gmContentJson' in thread && (
        <RichTextEditor
          label="GM-only content"
          content={thread.gmContentJson ?? null}
          editable={false}
          campaignId={campaign.id}
        />
      )}

      <div className="wb-related-content">
        <div>
          <h2>Related Entities</h2>
          {thread.entities.length === 0 && <p>No related entities.</p>}
          <ul className="wb-relationship-list">
            {thread.entities.map((entity) => (
              <li key={entity.id}>
                <Link to={`/app/campaign/${campaign.id}/world/${entity.id}`}>{entity.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Session Timeline</h2>
          {thread.sessions.length === 0 && <p>No session history yet.</p>}
          <ul className="wb-relationship-list">
            {thread.sessions.map((entry) => (
              <li key={entry.session.id}>
                <Link to={`/app/campaign/${campaign.id}/sessions/${entry.session.id}`}>
                  Session {entry.session.sessionNumber}: {entry.session.title}
                </Link>
                {' — '}
                {entry.action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
