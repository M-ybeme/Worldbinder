import { FormMessage } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useSessionsQuery } from '../hooks/useSessions'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function SessionListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const sessionsQuery = useSessionsQuery(campaign.id)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Sessions</h1>
        {canCreate && (
          <Link
            className="wb-button wb-button--primary"
            to={`/app/campaign/${campaign.id}/sessions/new`}
          >
            New session
          </Link>
        )}
      </header>

      {sessionsQuery.isLoading && <p>Loading sessions…</p>}
      {sessionsQuery.isError && <FormMessage message={sessionsQuery.error.message} />}

      <ul className="wb-session-list">
        {sessionsQuery.data?.map((session) => (
          <li key={session.id}>
            <Link to={`/app/campaign/${campaign.id}/sessions/${session.id}`}>
              Session {session.sessionNumber}: {session.title}
            </Link>
            <span className="wb-session-list__meta">
              {session.status}
              {session.visibility === 'gm_only' ? ' · GM only' : ''}
            </span>
          </li>
        ))}
        {sessionsQuery.data?.length === 0 && <li>No sessions yet.</li>}
      </ul>
    </section>
  )
}
