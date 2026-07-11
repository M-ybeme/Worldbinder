export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export const RATE_LIMITS = {
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
  loginPerIpAndEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  forgotPasswordPerIp: { limit: 5, windowSeconds: 60 * 60 },
  resendVerificationPerIp: { limit: 5, windowSeconds: 60 * 60 },
} as const;
