import type { HealthCheckResponse } from '@worldbinder/contracts'
import { useEffect, useState } from 'react'
import { fetchHealth } from '../api/health'

type HealthQueryState =
  | { state: 'loading' }
  | { state: 'success'; data: HealthCheckResponse }
  | { state: 'error'; error: Error }

export function useApiHealth(): HealthQueryState {
  const [result, setResult] = useState<HealthQueryState>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetchHealth()
      .then((data) => {
        if (!cancelled) setResult({ state: 'success', data })
      })
      .catch((error: Error) => {
        if (!cancelled) setResult({ state: 'error', error })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return result
}
