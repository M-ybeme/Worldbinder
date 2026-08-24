import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateSessionDialog } from '../components/QuickCreateSessionDialog'
import { useSessionsQuery } from '../hooks/useSessions'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function SessionListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const sessionsQuery = useSessionsQuery(campaign.id)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Sessions</h1>
        {canCreate && <Button onClick={() => setQuickCreateOpen(true)}>New session</Button>}
      </header>

      <QuickCreateSessionDialog
        campaignId={campaign.id}
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

      {sessionsQuery.isLoading && <LoadingState label="Loading sessions…" />}
      {sessionsQuery.isError && (
        <ErrorState message={sessionsQuery.error.message} onRetry={() => sessionsQuery.refetch()} />
      )}
      {!sessionsQuery.isLoading && !sessionsQuery.isError && sessionsQuery.data?.length === 0 && (
        <EmptyState message="No sessions yet." />
      )}

      {!sessionsQuery.isLoading && !sessionsQuery.isError && !!sessionsQuery.data?.length && (
        <ul className="wb-session-list">
          {sessionsQuery.data.map((session) => (
            <li key={session.id}>
              <Link to={`/app/campaign/${campaign.id}/sessions/${session.id}`}>
                Session {session.sessionNumber}: {session.title}
              </Link>
              <span className="wb-session-list__meta">
                {session.status}
                {session.visibility === 'gm_only' && (
                  <>
                    {' '}
                    <Badge tone="warning">GM only</Badge>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
