import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { registerSchema, type RegisterInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useRegister } from '../hooks/useAuthMutations'

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })
  const registerAccount = useRegister()

  const onSubmit = handleSubmit((data) => registerAccount.mutate(data))

  if (registerAccount.isSuccess) {
    return (
      <section>
        <h1>Check your inbox</h1>
        <p>{registerAccount.data.message}</p>
        <Link to="/login">Back to log in</Link>
      </section>
    )
  }

  return (
    <section>
      <h1>Create an account</h1>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Display name"
          type="text"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormMessage message={registerAccount.error?.message} />
        <Button type="submit" disabled={registerAccount.isPending}>
          {registerAccount.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <div className="wb-links">
        <Link to="/login">Already have an account?</Link>
      </div>
    </section>
  )
}
