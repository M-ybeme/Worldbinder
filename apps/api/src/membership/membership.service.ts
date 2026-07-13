import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignInvitationSummary,
  InvitationPreview,
  MembershipSummary,
} from '@worldbinder/contracts';
import type {
  InviteMemberInput,
  UpdateMemberRoleInput,
} from '@worldbinder/validation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { TokenService } from '../auth/token.service';
import { RateLimiterService } from '../common/rate-limiter.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  campaignInvitations,
  campaignMembers,
  campaigns,
  users,
} from '../database/schema';
import { MailService } from '../mail/mail.service';
import { CampaignPolicyService } from './campaign-policy.service';
import type { CampaignMembership } from './guards/campaign-membership.guard';
import {
  CAMPAIGN_INVITATION_TTL_MS,
  RATE_LIMITS,
} from './membership.constants';

@Injectable()
export class MembershipService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly policy: CampaignPolicyService,
    private readonly rateLimiter: RateLimiterService,
    private readonly audit: CampaignAuditService,
  ) {}

  async listMembers(campaignId: string): Promise<MembershipSummary[]> {
    const rows = await this.db
      .select({
        id: campaignMembers.id,
        userId: campaignMembers.userId,
        email: users.email,
        displayName: users.displayName,
        role: campaignMembers.role,
        editorSecretAccess: campaignMembers.editorSecretAccess,
        status: campaignMembers.status,
        createdAt: campaignMembers.createdAt,
      })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(
        and(
          eq(campaignMembers.campaignId, campaignId),
          eq(campaignMembers.status, 'active'),
        ),
      )
      .orderBy(desc(campaignMembers.createdAt));

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listInvitations(
    campaignId: string,
  ): Promise<CampaignInvitationSummary[]> {
    const rows = await this.db
      .select()
      .from(campaignInvitations)
      .where(
        and(
          eq(campaignInvitations.campaignId, campaignId),
          isNull(campaignInvitations.acceptedAt),
          isNull(campaignInvitations.revokedAt),
        ),
      )
      .orderBy(desc(campaignInvitations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      invitedByUserId: row.invitedByUserId,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async inviteMember(
    campaignId: string,
    actor: CampaignMembership,
    input: InviteMemberInput,
    ipHash: string,
  ): Promise<{ message: string }> {
    if (!this.policy.canManageMembers(actor.role)) {
      throw new ForbiddenException(
        'You cannot invite members to this campaign',
      );
    }

    await this.assertWithinLimit(
      `invite-campaign:${campaignId}`,
      RATE_LIMITS.invitesPerCampaign,
    );
    await this.assertWithinLimit(
      `invite-ip:${ipHash}`,
      RATE_LIMITS.invitesPerActorIp,
    );

    const [existingMember] = await this.db
      .select({ id: campaignMembers.id })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(
        and(
          eq(campaignMembers.campaignId, campaignId),
          eq(users.email, input.email),
          eq(campaignMembers.status, 'active'),
        ),
      );

    if (existingMember) {
      throw new ConflictException(
        'This person is already a member of the campaign',
      );
    }

    // Superseding any prior pending invite for the same address keeps "one
    // active invite per email" without a unique constraint.
    await this.db
      .update(campaignInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(campaignInvitations.campaignId, campaignId),
          eq(campaignInvitations.email, input.email),
          isNull(campaignInvitations.acceptedAt),
          isNull(campaignInvitations.revokedAt),
        ),
      );

    const [campaign] = await this.db
      .select({ name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (!campaign) throw new NotFoundException('Campaign not found');

    const rawToken = this.tokens.generateOpaqueToken();
    await this.db.insert(campaignInvitations).values({
      campaignId,
      email: input.email,
      role: input.role,
      tokenHash: this.tokens.hashOpaqueToken(rawToken),
      invitedByUserId: actor.userId,
      expiresAt: new Date(Date.now() + CAMPAIGN_INVITATION_TTL_MS),
    });

    await this.mail.sendCampaignInviteEmail(
      input.email,
      rawToken,
      campaign.name,
    );

    return { message: 'Invitation sent.' };
  }

  async revokeInvitation(
    campaignId: string,
    actor: CampaignMembership,
    invitationId: string,
  ): Promise<void> {
    if (!this.policy.canManageMembers(actor.role)) {
      throw new ForbiddenException(
        'You cannot manage invitations for this campaign',
      );
    }

    const [invitation] = await this.db
      .select({ id: campaignInvitations.id })
      .from(campaignInvitations)
      .where(
        and(
          eq(campaignInvitations.id, invitationId),
          eq(campaignInvitations.campaignId, campaignId),
          isNull(campaignInvitations.revokedAt),
          isNull(campaignInvitations.acceptedAt),
        ),
      );

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.db
      .update(campaignInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(campaignInvitations.id, invitationId));
  }

  async previewInvitation(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.getValidInvitation(rawToken);
    const [campaign] = await this.db
      .select({ name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, invitation.campaignId));

    if (!campaign) throw new NotFoundException('Invitation not found');

    return {
      campaignName: campaign.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(
    rawToken: string,
    currentUser: { id: string; email: string },
  ): Promise<{ campaignId: string }> {
    const invitation = await this.getValidInvitation(rawToken);

    if (invitation.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: campaignMembers.id })
        .from(campaignMembers)
        .where(
          and(
            eq(campaignMembers.campaignId, invitation.campaignId),
            eq(campaignMembers.userId, currentUser.id),
          ),
        );

      if (existing) {
        await tx
          .update(campaignMembers)
          .set({
            role: invitation.role,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(campaignMembers.id, existing.id));
      } else {
        await tx.insert(campaignMembers).values({
          campaignId: invitation.campaignId,
          userId: currentUser.id,
          role: invitation.role,
        });
      }

      await tx
        .update(campaignInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(campaignInvitations.id, invitation.id));
    });

    return { campaignId: invitation.campaignId };
  }

  async updateMemberRole(
    campaignId: string,
    actor: CampaignMembership,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<void> {
    const target = await this.getActiveMember(campaignId, memberId);

    if (!this.policy.canChangeRole(actor.role, target.role, input.role)) {
      throw new ForbiddenException("You cannot change this member's role");
    }

    await this.db
      .update(campaignMembers)
      .set({
        role: input.role,
        editorSecretAccess:
          input.editorSecretAccess ??
          (input.role === 'editor' ? target.editorSecretAccess : false),
        updatedAt: new Date(),
      })
      .where(eq(campaignMembers.id, memberId));

    await this.audit.record({
      campaignId,
      type: 'member_role_changed',
      actorUserId: actor.userId,
      targetResourceType: 'campaign_member',
      targetResourceId: memberId,
      metadata: { fromRole: target.role, toRole: input.role },
    });
  }

  async removeMember(
    campaignId: string,
    actor: CampaignMembership,
    memberId: string,
  ): Promise<void> {
    const target = await this.getActiveMember(campaignId, memberId);

    if (!this.policy.canRemoveMember(actor.role, target.role)) {
      throw new ForbiddenException('You cannot remove this member');
    }

    await this.db
      .update(campaignMembers)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(eq(campaignMembers.id, memberId));

    await this.audit.record({
      campaignId,
      type: 'member_removed',
      actorUserId: actor.userId,
      targetResourceType: 'campaign_member',
      targetResourceId: memberId,
      metadata: { removedRole: target.role },
    });
  }

  private async getActiveMember(campaignId: string, memberId: string) {
    const [member] = await this.db
      .select()
      .from(campaignMembers)
      .where(
        and(
          eq(campaignMembers.id, memberId),
          eq(campaignMembers.campaignId, campaignId),
          eq(campaignMembers.status, 'active'),
        ),
      );

    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  private async getValidInvitation(rawToken: string) {
    const tokenHash = this.tokens.hashOpaqueToken(rawToken);
    const [invitation] = await this.db
      .select()
      .from(campaignInvitations)
      .where(eq(campaignInvitations.tokenHash, tokenHash));

    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    return invitation;
  }

  private async assertWithinLimit(
    key: string,
    config: { limit: number; windowSeconds: number },
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume(
      key,
      config.limit,
      config.windowSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many invitations sent. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
