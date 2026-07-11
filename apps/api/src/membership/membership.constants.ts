export const CAMPAIGN_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RATE_LIMITS = {
  invitesPerCampaign: { limit: 20, windowSeconds: 60 * 60 },
  invitesPerActorIp: { limit: 30, windowSeconds: 60 * 60 },
} as const;
