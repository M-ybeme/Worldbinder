import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CampaignRole } from '@worldbinder/contracts';
import { CAMPAIGN_ROLES_KEY } from './campaign-roles.decorator';
import type { CampaignScopedRequest } from './campaign-membership.guard';

/** Coarse route-level gating on top of `CampaignMembershipGuard` — must run after it. */
@Injectable()
export class CampaignRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      CampaignRole[] | undefined
    >(CAMPAIGN_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<CampaignScopedRequest>();
    if (!required.includes(request.membership.role)) {
      throw new ForbiddenException('Insufficient campaign role');
    }
    return true;
  }
}
