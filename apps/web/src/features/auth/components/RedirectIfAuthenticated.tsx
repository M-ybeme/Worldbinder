import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface LocationState {
  from?: { pathname: string }
}

/** A logged-in visitor landing here (e.g. right after this component fires,
 * mid-login-transition) redirects away. Respects `location.state.from`,
 * the same "where did the user actually want to go" state LoginPage's own
 * submit handler reads — without it, this always wins the race against an
 * onSuccess-handler `navigate()` call (both fire off the same auth-status
 * change, but this component's redirect happens synchronously during
 * render), silently overriding any other destination a caller intended. */
export function RedirectIfAuthenticated() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'authenticated') {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/account/profile'
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
