import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '../hooks/useAuthMutations'

export function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })
  const forgotPassword = useForgotPassword()

  const onSubmit = handleSubmit((data) => forgotPassword.mutate(data))

  if (forgotPassword.isSuccess) {
    return (
      <section>
        <h1>Check your inbox</h1>
        <p>{forgotPassword.data.message}</p>
        <Link to="/login">Back to log in</Link>
      </section>
    )
  }

  return (
    <section>
      <h1>Forgot password</h1>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormMessage message={forgotPassword.error?.message} />
        <Button type="submit" disabled={forgotPassword.isPending}>
          {forgotPassword.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div className="wb-links">
        <Link to="/login">Back to log in</Link>
      </div>
    </section>
  )
}
