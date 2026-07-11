import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CampaignScopedRequest } from './campaign-membership.guard';

export const CurrentMembership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<CampaignScopedRequest>();
    return request.membership;
  },
);
