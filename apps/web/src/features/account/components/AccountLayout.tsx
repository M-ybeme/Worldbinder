import { Button } from '@worldbinder/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { useLogout } from '../../auth/hooks/useAuthMutations'

export function AccountLayout() {
  const logout = useLogout()

  return (
    <div>
      <nav className="wb-links">
        <NavLink to="/account/profile">Profile</NavLink>
        <NavLink to="/account/security">Security</NavLink>
        <NavLink to="/account/sessions">Sessions</NavLink>
      </nav>
      <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Log out
      </Button>
      <Outlet />
    </div>
  )
}
