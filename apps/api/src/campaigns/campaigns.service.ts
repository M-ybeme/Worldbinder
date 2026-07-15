import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CalendarConfig,
  CampaignActivityItem,
  CampaignDashboard,
  CampaignDetail,
  CampaignSessionSummary,
  CampaignSummary,
  PlotThreadSummary,
  TimelineDate,
  WorldDate,
} from '@worldbinder/contracts';
import {
  DEFAULT_CALENDAR_CONFIG,
  isValidTimelineDate,
  isValidWorldDate,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from '@worldbinder/validation';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  attachments,
  campaignMembers,
  campaigns,
  entities,
  plotThreads,
  sessions,
  timelineEvents,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import {
  isNeglected,
  projectPlayerFacingStatus,
} from '../plot-threads/plot-threads.service';
import { StorageService } from '../storage/storage.service';

type PlotThreadRow = typeof plotThreads.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly audit: CampaignAuditService,
    private readonly storage: StorageService,
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

    // Milestone 14 Phase 6 — batched, not one attachments query per
    // campaign in the loop below (the confirmed N+1 the audit found).
    const coverImageUrlByAttachmentId = await this.resolveCoverImageUrls(
      rows
        .map(({ campaign }) => campaign.coverAttachmentId)
        .filter((id): id is string => id !== null),
    );

    return Promise.all(
      rows.map(({ campaign, role }) =>
        this.toSummary(campaign, role, coverImageUrlByAttachmentId),
      ),
    );
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
      input.currentWorldDateJson !== undefined ||
      input.calendarConfigJson !== undefined ||
      input.coverAttachmentId !== undefined;

    if (hasNameChange && !this.policy.canRenameCampaign(membership.role)) {
      throw new ForbiddenException('Only the owner can rename this campaign');
    }
    if (hasOtherFields && !this.policy.canManageSettings(membership.role)) {
      throw new ForbiddenException("You cannot edit this campaign's settings");
    }
    if (!hasNameChange && !hasOtherFields) {
      return this.getById(campaignId, membership);
    }

    if (
      input.coverAttachmentId !== undefined &&
      input.coverAttachmentId !== null
    ) {
      await this.requireReadyImageAttachment(
        campaignId,
        input.coverAttachmentId,
      );
    }

    if (input.calendarConfigJson !== undefined) {
      await this.assertCalendarChangeKeepsExistingDatesValid(
        campaignId,
        input.calendarConfigJson,
        input.currentWorldDateJson,
      );
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
        ...(input.calendarConfigJson !== undefined
          ? { calendarConfigJson: input.calendarConfigJson }
          : {}),
        ...(input.coverAttachmentId !== undefined
          ? { coverAttachmentId: input.coverAttachmentId }
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

    await this.audit.record({
      campaignId,
      type: 'campaign_archived',
      actorUserId: membership.userId,
    });
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

    await this.audit.record({
      campaignId,
      type: 'campaign_deleted',
      actorUserId: membership.userId,
    });
  }

  /**
   * "Dashboard aggregation" (roadmap §11.2) — reads entities/sessions/
   * plot_threads directly rather than injecting their services: this is a
   * read-only cross-cutting query, and the codebase already has precedent
   * for direct cross-table reads at this scale (e.g. `SessionsService`
   * writes `campaigns.currentWorldDateJson` directly rather than going
   * through `CampaignsService`).
   */
  async getDashboard(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<CampaignDashboard> {
    const campaign = await this.requireCampaign(campaignId);
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const sessionVisibility = canViewGm
      ? []
      : [eq(sessions.visibility, 'public' as const)];
    const entityVisibility = canViewGm
      ? []
      : [eq(entities.visibility, 'public' as const)];
    const threadVisibility = canViewGm
      ? []
      : [eq(plotThreads.visibility, 'public' as const)];

    const [upcomingSessionRow] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
          eq(sessions.status, 'planned'),
          isNotNull(sessions.scheduledAt),
          ...sessionVisibility,
        ),
      )
      .orderBy(sessions.scheduledAt)
      .limit(1);

    const [lastPlayedRow] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
          eq(sessions.status, 'completed'),
          ...sessionVisibility,
        ),
      )
      .orderBy(desc(sessions.playedAt))
      .limit(1);

    const [latestCompletedRow] = await this.db
      .select({ max: sql<number | null>`max(${sessions.sessionNumber})` })
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          eq(sessions.status, 'completed'),
          isNull(sessions.deletedAt),
        ),
      );
    const latestCompletedSessionNumber = latestCompletedRow?.max ?? null;

    const threadRows = await this.db
      .select({ thread: plotThreads, lastSession: sessions })
      .from(plotThreads)
      .leftJoin(sessions, eq(sessions.id, plotThreads.lastReferencedSessionId))
      .where(
        and(
          eq(plotThreads.campaignId, campaignId),
          isNull(plotThreads.deletedAt),
          ...threadVisibility,
        ),
      );

    const threadsWithNeglect = threadRows.map((row) => ({
      ...row,
      neglected: isNeglected(
        {
          status: row.thread.status,
          lastReferencedSessionNumber: row.lastSession?.sessionNumber ?? null,
        },
        latestCompletedSessionNumber,
      ),
    }));

    const activeThreads: PlotThreadSummary[] = threadsWithNeglect
      .filter(
        (row) =>
          row.thread.status !== 'resolved' && row.thread.status !== 'abandoned',
      )
      .sort(
        (a, b) => b.thread.updatedAt.getTime() - a.thread.updatedAt.getTime(),
      )
      .slice(0, 10)
      .map((row) =>
        toThreadSummary(row.thread, row.lastSession, row.neglected, canViewGm),
      );

    const neglectedThreads: PlotThreadSummary[] = threadsWithNeglect
      .filter((row) => row.neglected)
      .sort(
        (a, b) => b.thread.updatedAt.getTime() - a.thread.updatedAt.getTime(),
      )
      .map((row) =>
        toThreadSummary(row.thread, row.lastSession, row.neglected, canViewGm),
      );

    const recentEntities = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
          ...entityVisibility,
        ),
      )
      .orderBy(desc(entities.updatedAt))
      .limit(5);

    const recentSessions = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
          ...sessionVisibility,
        ),
      )
      .orderBy(desc(sessions.updatedAt))
      .limit(5);

    // Roadmap's ui-ux.md sketch shows "Recently Edited" and "Recent
    // Activity" as two separate widgets; there's no activity-log table in
    // the data model (only `security_events`, which is auth-only), so one
    // honest "recently changed" feed backs both rather than fabricating a
    // second data source.
    const recentActivity: CampaignActivityItem[] = [
      ...recentEntities.map((entity) => ({
        resourceType: 'entity' as const,
        id: entity.id,
        title: entity.name,
        updatedAt: entity.updatedAt.toISOString(),
      })),
      ...recentSessions.map((session) => ({
        resourceType: 'session' as const,
        id: session.id,
        title: `Session ${session.sessionNumber}: ${session.title}`,
        updatedAt: session.updatedAt.toISOString(),
      })),
      ...threadRows.map((row) => ({
        resourceType: 'plot_thread' as const,
        id: row.thread.id,
        title: row.thread.title,
        updatedAt: row.thread.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10);

    return {
      currentWorldDateJson: campaign.currentWorldDateJson as WorldDate | null,
      status: campaign.status,
      upcomingSession: upcomingSessionRow
        ? toSessionSummary(upcomingSessionRow)
        : null,
      lastPlayedSession: lastPlayedRow ? toSessionSummary(lastPlayedRow) : null,
      activeThreads,
      neglectedThreads,
      recentActivity,
    };
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

  /**
   * The concrete mechanism behind "existing dates remain interpretable
   * after allowed calendar changes" (Milestone 11 exit criterion): before
   * accepting a new calendar config, re-validate every date already stored
   * under this campaign — its own `currentWorldDateJson`, every session's
   * world start/end date, every timeline event's start/end date — against
   * the *new* config, rejecting with 409 if any would become invalid.
   * Reads `sessions`/`timeline_events` directly (no SessionsModule/
   * TimelineModule import), same "sibling table read" precedent as
   * `requireReadyImageAttachment` below.
   */
  private async assertCalendarChangeKeepsExistingDatesValid(
    campaignId: string,
    newConfigInput: CalendarConfig | null,
    incomingCurrentWorldDate: WorldDate | null | undefined,
  ): Promise<void> {
    const config = newConfigInput ?? DEFAULT_CALENDAR_CONFIG;

    const campaign = await this.requireCampaign(campaignId);
    const effectiveCurrentWorldDate =
      incomingCurrentWorldDate !== undefined
        ? incomingCurrentWorldDate
        : (campaign.currentWorldDateJson as WorldDate | null);
    if (
      effectiveCurrentWorldDate &&
      !isValidWorldDate(effectiveCurrentWorldDate, config)
    ) {
      throw new ConflictException(
        "This campaign's current in-world date is not valid under the new calendar. Adjust it first.",
      );
    }

    const sessionRows = await this.db
      .select({
        worldStartDateJson: sessions.worldStartDateJson,
        worldEndDateJson: sessions.worldEndDateJson,
      })
      .from(sessions)
      .where(
        and(eq(sessions.campaignId, campaignId), isNull(sessions.deletedAt)),
      );
    for (const row of sessionRows) {
      const start = row.worldStartDateJson as WorldDate | null;
      const end = row.worldEndDateJson as WorldDate | null;
      if (
        (start && !isValidWorldDate(start, config)) ||
        (end && !isValidWorldDate(end, config))
      ) {
        throw new ConflictException(
          'One or more sessions have a world date that is not valid under the new calendar. Adjust them first.',
        );
      }
    }

    const eventRows = await this.db
      .select({
        startDateJson: timelineEvents.startDateJson,
        endDateJson: timelineEvents.endDateJson,
        datePrecision: timelineEvents.datePrecision,
      })
      .from(timelineEvents)
      .where(eq(timelineEvents.campaignId, campaignId));
    for (const row of eventRows) {
      const start = row.startDateJson as TimelineDate | null;
      const end = row.endDateJson as TimelineDate | null;
      if (!start || !row.datePrecision) continue;
      if (
        !isValidTimelineDate(start, row.datePrecision, config) ||
        (end && !isValidTimelineDate(end, row.datePrecision, config))
      ) {
        throw new ConflictException(
          'One or more timeline events have a date that is not valid under the new calendar. Adjust them first.',
        );
      }
    }
  }

  /** Direct DRIZZLE read of `attachments`, not an injected AttachmentsService
   * — same "read a sibling table directly" precedent as getDashboard() —
   * avoids a CampaignsModule <-> AttachmentsModule dependency entirely. */
  private async requireReadyImageAttachment(
    campaignId: string,
    attachmentId: string,
  ): Promise<void> {
    const [attachment] = await this.db
      .select({
        campaignId: attachments.campaignId,
        status: attachments.status,
        detectedMimeType: attachments.detectedMimeType,
      })
      .from(attachments)
      .where(
        and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)),
      );

    if (!attachment || attachment.campaignId !== campaignId) {
      throw new NotFoundException('Attachment not found in this campaign');
    }
    if (attachment.status !== 'ready') {
      throw new ForbiddenException(
        'Attachment is not ready to be used as a cover image',
      );
    }
    if (!attachment.detectedMimeType?.startsWith('image/')) {
      throw new ForbiddenException('Cover image must be an image attachment');
    }
  }

  /** Freshly signed on every request, same ~15min expiry as
   * StorageService.presignDownload's other callers — no visibility gate: a
   * campaign's own name/description already has none, so the cover image
   * isn't gated by attachments.visibility either (see attachments module
   * doc comments for the full reasoning). */
  /** Single-campaign case (toDetail/getById et al.) — one query, fine at
   * that scale. `list()` uses the batched `resolveCoverImageUrls` below
   * instead of calling this per row. */
  private async resolveCoverImageUrl(
    coverAttachmentId: string | null,
  ): Promise<string | null> {
    if (!coverAttachmentId) return null;
    const urls = await this.resolveCoverImageUrls([coverAttachmentId]);
    return urls.get(coverAttachmentId) ?? null;
  }

  /** Batched — one `attachments` query for every cover image in a list,
   * not one per campaign (the N+1 Milestone 14 Phase 6 found). */
  private async resolveCoverImageUrls(
    coverAttachmentIds: string[],
  ): Promise<Map<string, string>> {
    if (coverAttachmentIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        id: attachments.id,
        storageKey: attachments.storageKey,
        originalFilename: attachments.originalFilename,
        status: attachments.status,
      })
      .from(attachments)
      .where(
        and(
          inArray(attachments.id, coverAttachmentIds),
          isNull(attachments.deletedAt),
        ),
      );

    const entries = await Promise.all(
      rows
        .filter((row) => row.status === 'ready')
        .map(
          async (row) =>
            [
              row.id,
              await this.storage.presignDownload(
                row.storageKey,
                row.originalFilename,
              ),
            ] as const,
        ),
    );
    return new Map(entries);
  }

  private async toSummary(
    campaign: typeof campaigns.$inferSelect,
    role: CampaignMembership['role'],
    coverImageUrlByAttachmentId?: Map<string, string>,
  ): Promise<CampaignSummary> {
    const coverImageUrl = coverImageUrlByAttachmentId
      ? campaign.coverAttachmentId
        ? (coverImageUrlByAttachmentId.get(campaign.coverAttachmentId) ?? null)
        : null
      : await this.resolveCoverImageUrl(campaign.coverAttachmentId);

    return {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      systemName: campaign.systemName,
      status: campaign.status,
      role,
      coverImageUrl,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      archivedAt: campaign.archivedAt?.toISOString() ?? null,
    };
  }

  private async toDetail(
    campaign: typeof campaigns.$inferSelect,
    role: CampaignMembership['role'],
  ): Promise<CampaignDetail> {
    return {
      ...(await this.toSummary(campaign, role)),
      settingsJson: campaign.settingsJson as Record<string, unknown> | null,
      currentWorldDateJson: campaign.currentWorldDateJson as WorldDate | null,
      calendarConfigJson: campaign.calendarConfigJson as CalendarConfig | null,
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

/** Mirrors `PlotThreadsService`'s private `toSummary` — small duplication,
 * consistent with this codebase's existing per-module mapping-function
 * precedent (`toEntitySummary` is already duplicated across several
 * modules) rather than a shared cross-cutting utils file. */
function toThreadSummary(
  thread: PlotThreadRow,
  lastSession: SessionRow | null,
  neglected: boolean,
  canViewGm: boolean,
): PlotThreadSummary {
  return {
    id: thread.id,
    campaignId: thread.campaignId,
    title: thread.title,
    summary: thread.summary,
    playerFacingStatus: projectPlayerFacingStatus(thread.status),
    ...(canViewGm
      ? { status: thread.status, importance: thread.importance }
      : {}),
    visibility: thread.visibility,
    lastReferencedSession: lastSession
      ? {
          id: lastSession.id,
          sessionNumber: lastSession.sessionNumber,
          title: lastSession.title,
        }
      : null,
    neglected,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

function toSessionSummary(session: SessionRow): CampaignSessionSummary {
  return {
    id: session.id,
    campaignId: session.campaignId,
    sessionNumber: session.sessionNumber,
    title: session.title,
    status: session.status,
    scheduledAt: session.scheduledAt?.toISOString() ?? null,
    playedAt: session.playedAt?.toISOString() ?? null,
    worldStartDateJson:
      session.worldStartDateJson as CampaignSessionSummary['worldStartDateJson'],
    worldEndDateJson:
      session.worldEndDateJson as CampaignSessionSummary['worldEndDateJson'],
    visibility: session.visibility,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
