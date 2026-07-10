export interface HealthIndicatorResult {
  status: 'up' | 'down'
  [key: string]: unknown
}

export interface HealthCheckResponse {
  status: 'ok' | 'error' | 'shutting_down'
  info?: Record<string, HealthIndicatorResult>
  error?: Record<string, HealthIndicatorResult>
  details: Record<string, HealthIndicatorResult>
}
