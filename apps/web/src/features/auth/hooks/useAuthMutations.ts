import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as authApi from '../api/authApi'
import { useAuthStore } from '../store/authStore'

export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification })
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (result) => setSession(result.accessToken, result.user),
  })
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearSession()
      queryClient.clear()
    },
  })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword })
}

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword })
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword })
}
