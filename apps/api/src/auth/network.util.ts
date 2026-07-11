import { createHmac } from 'node:crypto';
import type { Request } from 'express';

/**
 * Privacy-reduced network metadata (roadmap §9.1: "ip_hash or privacy-reduced
 * network metadata") — never store raw client IPs.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

export function summarizeUserAgent(
  userAgent: string | undefined,
): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, 255);
}

export function extractClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
