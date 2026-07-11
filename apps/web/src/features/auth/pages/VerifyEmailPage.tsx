import { useQuery } from '@tanstack/react-query'
import { FormMessage } from '@worldbinder/ui'
import { Link, useSearchParams } from 'react-router-dom'
import * as authApi from '../api/authApi'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // useQuery, not useMutation+useEffect: a mutation fired from an effect is
  // tied to that render's observer, and StrictMode's dev-only double-mount
  // discards the first one mid-flight, leaving the (current) second observer
  // stuck pending forever since nothing ever calls .mutate() on it. A query
  // keyed on the token is exactly the "run once on mount" primitive React
  // Query is designed for — both mount attempts share the same cache entry.
  const verifyEmail = useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => authApi.verifyEmail({ token: token as string }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })

  if (!token) {
    return (
      <section>
        <h1>Verify your email</h1>
        <FormMessage message="This link is missing a verification token." />
      </section>
    )
  }

  return (
    <section>
      <h1>Verify your email</h1>
      {verifyEmail.isPending && <p>Verifying…</p>}
      {verifyEmail.isSuccess && (
        <>
          <FormMessage tone="success" message={verifyEmail.data.message} />
          <p>
            <Link to="/login">Continue to log in</Link>
          </p>
        </>
      )}
      {verifyEmail.isError && <FormMessage message={verifyEmail.error.message} />}
    </section>
  )
}
