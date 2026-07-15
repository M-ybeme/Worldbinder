import { LoadingState } from '@worldbinder/ui'
import { useAuthStore } from '../../auth/store/authStore'

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)

  if (!user) return <LoadingState label="Loading profile…" />

  return (
    <section>
      <h1>Profile</h1>
      <dl className="status-panel">
        <dt>Display name</dt>
        <dd>{user.displayName}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Email verified</dt>
        <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
      </dl>
    </section>
  )
}
