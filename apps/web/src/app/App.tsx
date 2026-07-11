import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store/authStore'

export function App() {
  const status = useAuthStore((state) => state.status)

  return (
    <div className="app-shell">
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
        </nav>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  )
}
