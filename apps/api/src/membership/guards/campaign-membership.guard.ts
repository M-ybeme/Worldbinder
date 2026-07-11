import {
  CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CampaignRole } from '@worldbinder/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard';
import { DRIZZLE, type Database } from '../../database/database.module';
import { campaignMembers, campaigns } from '../../database/schema';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CampaignMembership {
  id: string;
  campaignId: string;
  userId: string;
  role: CampaignRole;
  editorSecretAccess: boolean;
}

export interface CampaignScopedRequest extends AuthenticatedRequest {
  membership: CampaignMembership;
}

/**
 * Resolves `:campaignId` against the caller's active membership and attaches
 * it to the request. Returns 404 — never 403 — whether the campaign doesn't
 * exist, is soft-deleted, or the caller simply isn't a member, so a
 * non-member can't distinguish "wrong campaign" from "not your campaign"
 * (roadmap §13.1: no campaign resource reachable outside its tenant).
 */
@Injectable()
export class CampaignMembershipGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CampaignScopedRequest>();
    const campaignId = request.params.campaignId;

    if (
      !campaignId ||
      typeof campaignId !== 'string' ||
      !UUID_PATTERN.test(campaignId)
    ) {
      throw new NotFoundException('Campaign not found');
    }

    const [row] = await this.db
      .select({
        id: campaignMembers.id,
        campaignId: campaignMembers.campaignId,
        userId: campaignMembers.userId,
        role: campaignMembers.role,
        editorSecretAccess: campaignMembers.editorSecretAccess,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(
        and(
          eq(campaignMembers.campaignId, campaignId),
          eq(campaignMembers.userId, request.user.sub),
          eq(campaignMembers.status, 'active'),
          isNull(campaigns.deletedAt),
        ),
      );

    if (!row) {
      throw new NotFoundException('Campaign not found');
    }

    request.membership = row;
    return true;
  }
}
