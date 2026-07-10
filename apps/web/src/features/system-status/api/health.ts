import type { HealthCheckResponse } from '@worldbinder/contracts'
import { apiGet } from '../../../lib/apiClient'

export function fetchHealth(): Promise<HealthCheckResponse> {
  return apiGet<HealthCheckResponse>('/health')
}
