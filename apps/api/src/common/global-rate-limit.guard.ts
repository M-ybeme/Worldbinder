import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { extractClientIp } from '../auth/network.util';
import { RateLimiterService } from './rate-limiter.service';

/**
 * Generous per-IP floor applied to every route (registered as `APP_GUARD` —
 * see CommonModule), not a replacement for auth/membership's own tighter,
 * action-specific limits (registration, login, invites, etc.), which still
 * trip first for those routes. Everything else — entities, sessions, maps,
 * attachments, plot threads, timeline, exports, imports, campaigns CRUD —
 * had no request-volume control at all before this.
 *
 * 300 requests / 60s comfortably exceeds this repo's own heaviest e2e spec
 * file (42 requests, all from the same loopback IP) with plenty of margin,
 * while still meaningfully bounding bulk-creation/export-generation/
 * presigned-upload abuse from a single source.
 */
const GLOBAL_LIMIT = { limit: 300, windowSeconds: 60 };

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const allowed = await this.rateLimiter.consume(
      `global:${extractClientIp(req)}`,
      GLOBAL_LIMIT.limit,
      GLOBAL_LIMIT.windowSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
