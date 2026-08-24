import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store/authStore'

export function App() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()
  // CampaignLayout (rendered inside the Outlet for every /app/campaign/:id
  // route) already renders its own back-link, Help, and Account affordances
  // in its sidebar/topbar — this outer header would just be duplicate chrome
  // for that subtree, and its sibling <main> needs the full viewport width
  // instead of the narrow centered column every other route wants.
  const isCampaignWorkspace = location.pathname.startsWith('/app/campaign/')

  return (
    <div className="app-shell">
      {!isCampaignWorkspace && (
        <header className="app-shell__header">
          <span className="app-shell__brand">Worldbinder</span>
          <nav className="app-shell__nav">
            {status === 'authenticated' ? (
              <>
                <Link to="/app/campaigns">Campaigns</Link>
                <Link to="/account/profile">Account</Link>
              </>
            ) : (
              <Link to="/login">Log in</Link>
            )}
            <Link to="/help">Help</Link>
          </nav>
        </header>
      )}
      <main
        className={
          isCampaignWorkspace ? 'app-shell__main app-shell__main--full' : 'app-shell__main'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}
