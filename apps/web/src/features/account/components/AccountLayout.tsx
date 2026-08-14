import { Button } from '@worldbinder/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { useLogout } from '../../auth/hooks/useAuthMutations'
import './AccountLayout.css'

function navLinkClass({ isActive }: { isActive: boolean }): string | undefined {
  return isActive ? 'wb-links__link--active' : undefined
}

export function AccountLayout() {
  const logout = useLogout()

  return (
    <div>
      <div className="wb-account-layout__bar">
        <nav className="wb-links">
          <NavLink to="/account/profile" className={navLinkClass}>
            Profile
          </NavLink>
          <NavLink to="/account/security" className={navLinkClass}>
            Security
          </NavLink>
          <NavLink to="/account/sessions" className={navLinkClass}>
            Sessions
          </NavLink>
        </nav>
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Log out
        </Button>
      </div>
      <Outlet />
    </div>
  )
}
