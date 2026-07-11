import { FormMessage } from '@worldbinder/ui'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVerifyEmail } from '../hooks/useAuthMutations'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const verifyEmail = useVerifyEmail()
  const submitted = useRef(false)

  useEffect(() => {
    if (token && !submitted.current) {
      submitted.current = true
      verifyEmail.mutate({ token })
    }
  }, [token, verifyEmail])

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
