import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { changePasswordSchema, type ChangePasswordInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { useChangePassword } from '../../auth/hooks/useAuthMutations'

export function SecurityPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })
  const changePassword = useChangePassword()

  const onSubmit = handleSubmit((data) => {
    changePassword.mutate(data, { onSuccess: () => reset() })
  })

  return (
    <section>
      <h1>Security</h1>
      <h2>Change password</h2>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormMessage message={changePassword.error?.message} />
        {changePassword.isSuccess && <FormMessage tone="success" message={changePassword.data.message} />}
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </section>
  )
}
