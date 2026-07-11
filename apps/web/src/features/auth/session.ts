import type { AuthTokenResponse } from '@worldbinder/contracts'
import { apiRequest, configureApiClient } from '../../lib/apiClient'
import { useAuthStore } from './store/authStore'

let refreshInFlight: Promise<string | null> | null = null

/** Also used as the apiClient's 401 handler — a request that fails auth
 * triggers exactly one refresh attempt, shared by any concurrent callers. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const result = await apiRequest<AuthTokenResponse>('/auth/refresh', {
        method: 'POST',
        skipAuthRetry: true,
      })
      useAuthStore.getState().setSession(result.accessToken, result.user)
      return result.accessToken
    } catch {
      useAuthStore.getState().clearSession()
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: refreshAccessToken,
})

/** Call once on app boot to restore a session from the httpOnly refresh cookie
 * (the access token itself lives only in memory and doesn't survive a reload). */
export async function bootstrapSession(): Promise<void> {
  await refreshAccessToken()
}
