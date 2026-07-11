import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { z } from 'zod'
import { passwordSchema } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { useResetPassword } from '../hooks/useAuthMutations'

const formSchema = z.object({ newPassword: passwordSchema })
type FormInput = z.infer<typeof formSchema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema) })
  const resetPassword = useResetPassword()

  const onSubmit = handleSubmit((data) => {
    if (!token) return
    resetPassword.mutate({ token, newPassword: data.newPassword })
  })

  if (!token) {
    return (
      <section>
        <h1>Reset password</h1>
        <FormMessage message="This link is missing a reset token." />
      </section>
    )
  }

  if (resetPassword.isSuccess) {
    return (
      <section>
        <h1>Password reset</h1>
        <p>{resetPassword.data.message}</p>
        <Link to="/login">Continue to log in</Link>
      </section>
    )
  }

  return (
    <section>
      <h1>Reset password</h1>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormMessage message={resetPassword.error?.message} />
        <Button type="submit" disabled={resetPassword.isPending}>
          {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </section>
  )
}
