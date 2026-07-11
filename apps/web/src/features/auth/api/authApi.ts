import type { AuthTokenResponse, SessionSummary } from '@worldbinder/contracts'
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPost } from '../../../lib/apiClient'

export const register = (input: RegisterInput): Promise<{ message: string }> =>
  apiPost('/auth/register', input)

export const verifyEmail = (input: VerifyEmailInput): Promise<{ message: string }> =>
  apiPost('/auth/verify-email', input)

export const resendVerification = (input: ResendVerificationInput): Promise<{ message: string }> =>
  apiPost('/auth/resend-verification', input)

export const login = (input: LoginInput): Promise<AuthTokenResponse> => apiPost('/auth/login', input)

export const logout = (): Promise<{ message: string }> => apiPost('/auth/logout')

export const forgotPassword = (input: ForgotPasswordInput): Promise<{ message: string }> =>
  apiPost('/auth/forgot-password', input)

export const resetPassword = (input: ResetPasswordInput): Promise<{ message: string }> =>
  apiPost('/auth/reset-password', input)

export const changePassword = (input: ChangePasswordInput): Promise<{ message: string }> =>
  apiPost('/auth/change-password', input)

export const listSessions = (): Promise<SessionSummary[]> => apiGet('/auth/sessions')

export const revokeSession = (sessionId: string): Promise<{ message: string }> =>
  apiDelete(`/auth/sessions/${sessionId}`)
