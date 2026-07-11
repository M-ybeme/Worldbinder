import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { loginSchema, type LoginInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLogin } from '../hooks/useAuthMutations'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()

  const onSubmit = handleSubmit((data) => {
    login.mutate(data, {
      onSuccess: () => {
        const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/account/profile'
        navigate(redirectTo, { replace: true })
      },
    })
  })

  return (
    <section>
      <h1>Log in</h1>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormMessage message={login.error?.message} />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <div className="wb-links">
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/register">Create an account</Link>
      </div>
    </section>
  )
}
