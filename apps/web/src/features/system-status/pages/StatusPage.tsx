import { useApiHealth } from '../hooks/useApiHealth'

export function StatusPage() {
  const health = useApiHealth()

  return (
    <section>
      <h1>Campaign continuity, preserved.</h1>
      <p>Worldbinder foundation is running.</p>

      <dl className="status-panel">
        <dt>API connection</dt>
        <dd data-testid="api-health-status">
          {health.state === 'loading' && 'Checking…'}
          {health.state === 'success' && `Connected (${health.data.status})`}
          {health.state === 'error' && `Unreachable (${health.error.message})`}
        </dd>
      </dl>
    </section>
  )
}
