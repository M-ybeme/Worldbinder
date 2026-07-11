import { SetMetadata } from '@nestjs/common';
import type { CampaignRole } from '@worldbinder/contracts';

export const CAMPAIGN_ROLES_KEY = 'campaignRoles';

export const RequireCampaignRole = (...roles: CampaignRole[]) =>
  SetMetadata(CAMPAIGN_ROLES_KEY, roles);
