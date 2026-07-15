export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export const RATE_LIMITS = {
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
  loginPerIpAndEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  forgotPasswordPerIp: { limit: 5, windowSeconds: 60 * 60 },
  resendVerificationPerIp: { limit: 5, windowSeconds: 60 * 60 },
  // Milestone 14 Phase 5 — the rest of auth's endpoints had no rate limit
  // at all. verifyEmail/resetPassword both accept an opaque-token guess
  // from an unauthenticated caller, the same shape as a credential-guessing
  // attack, so they're tuned close to loginPerIpAndEmail's strictness
  // rather than the global default floor (see GlobalRateLimitGuard).
  verifyEmailPerIp: { limit: 20, windowSeconds: 15 * 60 },
  resetPasswordPerIp: { limit: 10, windowSeconds: 60 * 60 },
  // refresh/logout/changePassword are all normal, frequent parts of a
  // legitimate session lifecycle (refresh in particular fires on every
  // page load) — generous limits, mainly guarding against a runaway client
  // or scripted abuse rather than a realistic legitimate ceiling.
  refreshPerIp: { limit: 60, windowSeconds: 15 * 60 },
  logoutPerIp: { limit: 30, windowSeconds: 15 * 60 },
  changePasswordPerIp: { limit: 20, windowSeconds: 15 * 60 },
} as const;
