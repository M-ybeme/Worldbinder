import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignDetail,
  CampaignSummary,
  WorldDate,
} from '@worldbinder/contracts';
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
} from '@worldbinder/validation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DRIZZLE, type Database } from '../database/database.module';
import { campaignMembers, campaigns } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
  ) {}

  async create(
    userId: string,
    input: CreateCampaignInput,
  ): Promise<CampaignDetail> {
    const slug = await this.generateUniqueSlug(input.name);

    const campaign = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(campaigns)
        .values({
          ownerUserId: userId,
          name: input.name,
          slug,
          description: input.description ?? null,
          systemName: input.systemName ?? null,
        })
        .returning();

      if (!row) throw new Error('Failed to create campaign');

      await tx.insert(campaignMembers).values({
        campaignId: row.id,
        userId,
        role: 'owner',
      });

      return row;
    });

    return this.toDetail(campaign, 'owner');
  }

  async list(userId: string): Promise<CampaignSummary[]> {
    const rows = await this.db
      .select({ campaign: campaigns, role: campaignMembers.role })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(
        and(
          eq(campaignMembers.userId, userId),
          eq(campaignMembers.status, 'active'),
          isNull(campaigns.deletedAt),
        ),
      )
      .orderBy(desc(campaigns.updatedAt));

    return rows.map(({ campaign, role }) => this.toSummary(campaign, role));
  }

  async getById(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<CampaignDetail> {
    const campaign = await this.requireCampaign(campaignId);
    return this.toDetail(campaign, membership.role);
  }

  async update(
    campaignId: string,
    membership: CampaignMembership,
    input: UpdateCampaignInput,
  ): Promise<CampaignDetail> {
    const hasNameChange = input.name !== undefined;
    const hasOtherFields =
      input.description !== undefined ||
      input.systemName !== undefined ||
      input.settingsJson !== undefined ||
      input.currentWorldDateJson !== undefined;

    if (hasNameChange && !this.policy.canRenameCampaign(membership.role)) {
      throw new ForbiddenException('Only the owner can rename this campaign');
    }
    if (hasOtherFields && !this.policy.canManageSettings(membership.role)) {
      throw new ForbiddenException("You cannot edit this campaign's settings");
    }
    if (!hasNameChange && !hasOtherFields) {
      return this.getById(campaignId, membership);
    }

    const [updated] = await this.db
      .update(campaigns)
      .set({
        ...(hasNameChange ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.systemName !== undefined
          ? { systemName: input.systemName }
          : {}),
        ...(input.settingsJson !== undefined
          ? { settingsJson: input.settingsJson }
          : {}),
        ...(input.currentWorldDateJson !== undefined
          ? { currentWorldDateJson: input.currentWorldDateJson }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundException('Campaign not found');
    return this.toDetail(updated, membership.role);
  }

  async archive(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    if (!this.policy.canArchiveCampaign(membership.role)) {
      throw new ForbiddenException('You cannot archive this campaign');
    }
    const [updated] = await this.db
      .update(campaigns)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });

    if (!updated) throw new NotFoundException('Campaign not found');
  }

  async restore(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    if (!this.policy.canArchiveCampaign(membership.role)) {
      throw new ForbiddenException('You cannot restore this campaign');
    }
    const [updated] = await this.db
      .update(campaigns)
      .set({ status: 'active', archivedAt: null, updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });

    if (!updated) throw new NotFoundException('Campaign not found');
  }

  async delete(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    if (!this.policy.canDeleteCampaign(membership.role)) {
      throw new ForbiddenException('Only the owner can delete this campaign');
    }
    const [updated] = await this.db
      .update(campaigns)
      .set({ deletedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });

    if (!updated) throw new NotFoundException('Campaign not found');
  }

  private async requireCampaign(campaignId: string) {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)));
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'campaign';
    let candidate = base;
    let attempt = 0;

    while (attempt < 5) {
      const [existing] = await this.db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.slug, candidate));
      if (!existing) return candidate;
      candidate = `${base}-${randomBytes(3).toString('hex')}`;
      attempt += 1;
    }

    throw new Error('Failed to generate a unique campaign slug');
  }

  private toSummary(
    campaign: typeof campaigns.$inferSelect,
    role: CampaignMembership['role'],
  ): CampaignSummary {
    return {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      systemName: campaign.systemName,
      status: campaign.status,
      role,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      archivedAt: campaign.archivedAt?.toISOString() ?? null,
    };
  }

  private toDetail(
    campaign: typeof campaigns.$inferSelect,
    role: CampaignMembership['role'],
  ): CampaignDetail {
    return {
      ...this.toSummary(campaign, role),
      settingsJson: campaign.settingsJson as Record<string, unknown> | null,
      currentWorldDateJson: campaign.currentWorldDateJson as WorldDate | null,
    };
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
