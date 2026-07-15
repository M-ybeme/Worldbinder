import { Button, EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { useRevokeSessionMutation, useSessionsQuery } from '../../auth/hooks/useSessions'

export function SessionsPage() {
  const sessionsQuery = useSessionsQuery()
  const revokeSession = useRevokeSessionMutation()

  if (sessionsQuery.isLoading) return <LoadingState label="Loading sessions…" />
  if (sessionsQuery.isError) {
    return (
      <ErrorState message={sessionsQuery.error.message} onRetry={() => sessionsQuery.refetch()} />
    )
  }

  return (
    <section>
      <h1>Active sessions</h1>
      {sessionsQuery.data?.length === 0 ? (
        <EmptyState message="No active sessions." />
      ) : (
        <ul className="wb-session-list">
          {sessionsQuery.data?.map((session) => (
            <li key={session.id}>
              <div>
                <div>
                  {session.userAgentSummary ?? 'Unknown device'}
                  {session.current ? ' (this device)' : ''}
                </div>
                <div className="wb-session-list__meta">
                  Last used {new Date(session.lastUsedAt).toLocaleString()}
                </div>
              </div>
              {!session.current && (
                <Button
                  variant="secondary"
                  onClick={() => revokeSession.mutate(session.id)}
                  disabled={revokeSession.isPending}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
