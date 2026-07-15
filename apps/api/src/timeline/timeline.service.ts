import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignSessionSummary,
  EntitySummary,
  TimelineEventDetail,
  TimelineEventSummary,
  TiptapDoc,
} from '@worldbinder/contracts';
import {
  compareTimelineDates,
  DEFAULT_CALENDAR_CONFIG,
  isValidTimelineDate,
  type CalendarConfig,
  type CreateTimelineEventInput,
  type ListTimelineEventsQuery,
  type TimelineDate,
  type TimelineDatePrecision,
  type UpdateTimelineEventInput,
} from '@worldbinder/validation';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  campaigns,
  entities,
  sessions,
  tags,
  timelineEventEntities,
  timelineEvents,
  timelineEventSessions,
  timelineEventTags,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import {
  buildWeightedTsvector,
  extractPlainText,
} from '../search/search-vector.util';

type TimelineEventRow = typeof timelineEvents.$inferSelect;
type EntityRow = typeof entities.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

/** Roadmap §20.6's perf target (500 timeline events) — the whole
 * campaign-scoped, visibility-filtered set is fetched and sorted in JS via
 * `compareTimelineDates`, same "bounded query, sort in JS" precedent as
 * `search.service.ts`'s per-table merge. A custom calendar's variable
 * month lengths make expressing the sort in SQL impractical. */
const PER_CAMPAIGN_LIMIT = 500;

interface EffectiveDates {
  startDateJson: TimelineDate | null;
  endDateJson: TimelineDate | null;
  datePrecision: TimelineDatePrecision | null;
}

@Injectable()
export class TimelineService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly audit: CampaignAuditService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    input: CreateTimelineEventInput,
  ): Promise<TimelineEventDetail> {
    this.assertCanManage(membership);
    const config = await this.getCalendarConfig(campaignId);
    this.assertValidDates(
      {
        startDateJson: input.startDateJson ?? null,
        endDateJson: input.endDateJson ?? null,
        datePrecision: input.datePrecision ?? null,
      },
      config,
    );

    const searchVector = buildTimelineEventSearchVector({
      title: input.title,
      summary: input.summary ?? null,
      contentJson: input.contentJson ?? null,
    });

    const eventId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(timelineEvents)
        .values({
          campaignId,
          title: input.title,
          summary: input.summary ?? null,
          contentJson: input.contentJson ?? null,
          startDateJson: input.startDateJson ?? null,
          endDateJson: input.endDateJson ?? null,
          datePrecision: input.datePrecision ?? null,
          visibility: input.visibility ?? 'public',
          searchVector,
        })
        .returning();
      if (!row) throw new Error('Failed to create timeline event');

      if (input.entityIds) {
        await this.syncEntities(tx, campaignId, row.id, input.entityIds);
      }
      if (input.sessionIds) {
        await this.syncSessions(tx, campaignId, row.id, input.sessionIds);
      }
      if (input.tags) {
        await this.syncTags(tx, campaignId, row.id, input.tags);
      }

      return row.id;
    });

    return this.getById(campaignId, eventId, membership);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
    query: ListTimelineEventsQuery,
  ): Promise<TimelineEventSummary[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const config = await this.getCalendarConfig(campaignId);

    const conditions = [eq(timelineEvents.campaignId, campaignId)];
    if (!canViewGm) conditions.push(eq(timelineEvents.visibility, 'public'));

    let idFilter: Set<string> | null = null;

    if (query.entityId) {
      const rows = await this.db
        .select({ id: timelineEventEntities.timelineEventId })
        .from(timelineEventEntities)
        .where(eq(timelineEventEntities.entityId, query.entityId));
      idFilter = intersectFilter(
        idFilter,
        rows.map((row) => row.id),
      );
    }
    if (query.sessionId) {
      const rows = await this.db
        .select({ id: timelineEventSessions.timelineEventId })
        .from(timelineEventSessions)
        .where(eq(timelineEventSessions.sessionId, query.sessionId));
      idFilter = intersectFilter(
        idFilter,
        rows.map((row) => row.id),
      );
    }
    if (query.tag) {
      const rows = await this.db
        .select({ id: timelineEventTags.timelineEventId })
        .from(timelineEventTags)
        .innerJoin(tags, eq(tags.id, timelineEventTags.tagId))
        .where(
          and(
            eq(tags.campaignId, campaignId),
            eq(tags.normalizedName, normalizeTagName(query.tag)),
          ),
        );
      idFilter = intersectFilter(
        idFilter,
        rows.map((row) => row.id),
      );
    }

    if (idFilter) {
      if (idFilter.size === 0) return [];
      conditions.push(inArray(timelineEvents.id, Array.from(idFilter)));
    }

    const rows = await this.db
      .select()
      .from(timelineEvents)
      .where(and(...conditions))
      .limit(PER_CAMPAIGN_LIMIT);

    return rows
      .sort((a, b) => compareEventRows(a, b, config))
      .map((row) => toSummary(row));
  }

  async getById(
    campaignId: string,
    eventId: string,
    membership: CampaignMembership,
  ): Promise<TimelineEventDetail> {
    const event = await this.requireVisibleEvent(
      campaignId,
      eventId,
      membership,
    );
    return this.toDetail(event, membership);
  }

  async update(
    campaignId: string,
    eventId: string,
    membership: CampaignMembership,
    input: UpdateTimelineEventInput,
  ): Promise<TimelineEventDetail> {
    this.assertCanManage(membership);
    const existing = await this.requireVisibleEvent(
      campaignId,
      eventId,
      membership,
    );
    const config = await this.getCalendarConfig(campaignId);
    const effective = this.computeEffectiveDates(existing, input);
    this.assertValidDates(effective, config);

    const searchVector = buildTimelineEventSearchVector({
      title: input.title !== undefined ? input.title : existing.title,
      summary: input.summary !== undefined ? input.summary : existing.summary,
      contentJson:
        input.contentJson !== undefined
          ? input.contentJson
          : (existing.contentJson as TiptapDoc | null),
    });

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(timelineEvents)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.contentJson !== undefined
            ? { contentJson: input.contentJson }
            : {}),
          ...(input.startDateJson !== undefined
            ? { startDateJson: effective.startDateJson }
            : {}),
          ...(input.endDateJson !== undefined
            ? { endDateJson: effective.endDateJson }
            : {}),
          ...(input.datePrecision !== undefined
            ? { datePrecision: effective.datePrecision }
            : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
          updatedAt: new Date(),
          searchVector,
        })
        .where(
          and(
            eq(timelineEvents.id, eventId),
            eq(timelineEvents.campaignId, campaignId),
          ),
        )
        .returning();
      if (!row) throw new NotFoundException('Timeline event not found');

      if (input.entityIds !== undefined) {
        await this.syncEntities(tx, campaignId, eventId, input.entityIds);
      }
      if (input.sessionIds !== undefined) {
        await this.syncSessions(tx, campaignId, eventId, input.sessionIds);
      }
      if (input.tags !== undefined) {
        await this.syncTags(tx, campaignId, eventId, input.tags);
      }
    });

    return this.getById(campaignId, eventId, membership);
  }

  async delete(
    campaignId: string,
    eventId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);

    const [deleted] = await this.db
      .delete(timelineEvents)
      .where(
        and(
          eq(timelineEvents.id, eventId),
          eq(timelineEvents.campaignId, campaignId),
        ),
      )
      .returning({ id: timelineEvents.id });
    if (!deleted) throw new NotFoundException('Timeline event not found');

    await this.audit.record({
      campaignId,
      type: 'destructive_action',
      actorUserId: membership.userId,
      targetResourceType: 'timeline_event',
      targetResourceId: eventId,
      metadata: { action: 'delete' },
    });
  }

  private async toDetail(
    event: TimelineEventRow,
    membership: CampaignMembership,
  ): Promise<TimelineEventDetail> {
    const canSeeVisibility = (visibility: EntityRow['visibility']): boolean =>
      this.policy.canViewVisibility(
        visibility,
        membership.role,
        membership.editorSecretAccess,
      );

    const [entityRows, sessionRows, tagRows] = await Promise.all([
      this.db
        .select({ entity: entities })
        .from(timelineEventEntities)
        .innerJoin(entities, eq(entities.id, timelineEventEntities.entityId))
        .where(
          and(
            eq(timelineEventEntities.timelineEventId, event.id),
            isNull(entities.deletedAt),
          ),
        ),
      this.db
        .select({ session: sessions })
        .from(timelineEventSessions)
        .innerJoin(sessions, eq(sessions.id, timelineEventSessions.sessionId))
        .where(
          and(
            eq(timelineEventSessions.timelineEventId, event.id),
            isNull(sessions.deletedAt),
          ),
        ),
      this.db
        .select({ name: tags.name })
        .from(timelineEventTags)
        .innerJoin(tags, eq(tags.id, timelineEventTags.tagId))
        .where(eq(timelineEventTags.timelineEventId, event.id)),
    ]);

    return {
      ...toSummary(event),
      contentJson: event.contentJson as TiptapDoc | null,
      entities: entityRows
        .map((r) => r.entity)
        .filter((e) => canSeeVisibility(e.visibility))
        .map(toEntitySummary),
      sessions: sessionRows
        .map((r) => r.session)
        .filter((s) => canSeeVisibility(s.visibility))
        .map(toSessionSummary),
      tags: tagRows.map((r) => r.name),
    };
  }

  private async syncEntities(
    tx: Database,
    campaignId: string,
    timelineEventId: string,
    entityIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(entityIds));
    await tx
      .delete(timelineEventEntities)
      .where(eq(timelineEventEntities.timelineEventId, timelineEventId));
    if (uniqueIds.length === 0) return;

    const validRows = await tx
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          inArray(entities.id, uniqueIds),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    if (validRows.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more linked entities do not belong to this campaign',
      );
    }

    await tx
      .insert(timelineEventEntities)
      .values(uniqueIds.map((entityId) => ({ timelineEventId, entityId })));
  }

  private async syncSessions(
    tx: Database,
    campaignId: string,
    timelineEventId: string,
    sessionIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(sessionIds));
    await tx
      .delete(timelineEventSessions)
      .where(eq(timelineEventSessions.timelineEventId, timelineEventId));
    if (uniqueIds.length === 0) return;

    const validRows = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          inArray(sessions.id, uniqueIds),
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
        ),
      );
    if (validRows.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more linked sessions do not belong to this campaign',
      );
    }

    await tx
      .insert(timelineEventSessions)
      .values(uniqueIds.map((sessionId) => ({ timelineEventId, sessionId })));
  }

  /** Full-replace sync, same shape as `EntitiesService`'s `syncTags` —
   * duplicated rather than shared, consistent with this codebase's
   * existing per-module mapping/sync-function precedent. */
  private async syncTags(
    tx: Database,
    campaignId: string,
    timelineEventId: string,
    tagNames: string[],
  ): Promise<void> {
    const uniqueNames = Array.from(
      new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
    );

    await tx
      .delete(timelineEventTags)
      .where(eq(timelineEventTags.timelineEventId, timelineEventId));
    if (uniqueNames.length === 0) return;

    const tagIds: string[] = [];
    for (const name of uniqueNames) {
      const normalizedName = normalizeTagName(name);
      const [existingTag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.campaignId, campaignId),
            eq(tags.normalizedName, normalizedName),
          ),
        );

      if (existingTag) {
        tagIds.push(existingTag.id);
      } else {
        const [created] = await tx
          .insert(tags)
          .values({ campaignId, name, normalizedName })
          .returning({ id: tags.id });
        if (!created) throw new Error('Failed to create tag');
        tagIds.push(created.id);
      }
    }

    await tx
      .insert(timelineEventTags)
      .values(tagIds.map((tagId) => ({ timelineEventId, tagId })));
  }

  private async requireEvent(
    campaignId: string,
    eventId: string,
  ): Promise<TimelineEventRow> {
    const [row] = await this.db
      .select()
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.id, eventId),
          eq(timelineEvents.campaignId, campaignId),
        ),
      );
    if (!row) throw new NotFoundException('Timeline event not found');
    return row;
  }

  private async requireVisibleEvent(
    campaignId: string,
    eventId: string,
    membership: CampaignMembership,
  ): Promise<TimelineEventRow> {
    const event = await this.requireEvent(campaignId, eventId);
    const canSee = this.policy.canViewVisibility(
      event.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Timeline event not found');
    return event;
  }

  /** Reads `campaigns.calendarConfigJson` directly (no CampaignsModule
   * import) — same "sibling table read" precedent as MapsService's
   * `requireReadyImageAttachment`. Null means the campaign hasn't
   * configured a custom calendar yet. */
  private async getCalendarConfig(campaignId: string): Promise<CalendarConfig> {
    const [row] = await this.db
      .select({ calendarConfigJson: campaigns.calendarConfigJson })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    return (
      (row?.calendarConfigJson as CalendarConfig | null) ??
      DEFAULT_CALENDAR_CONFIG
    );
  }

  private computeEffectiveDates(
    existing: TimelineEventRow,
    input: UpdateTimelineEventInput,
  ): EffectiveDates {
    const startDateJson =
      input.startDateJson !== undefined
        ? input.startDateJson
        : (existing.startDateJson as TimelineDate | null);
    const endDateJson =
      input.endDateJson !== undefined
        ? input.endDateJson
        : (existing.endDateJson as TimelineDate | null);
    const datePrecision =
      input.datePrecision !== undefined
        ? input.datePrecision
        : existing.datePrecision;

    if ((startDateJson == null) !== (datePrecision == null)) {
      throw new BadRequestException(
        'startDateJson and datePrecision must be set together',
      );
    }

    return { startDateJson, endDateJson, datePrecision };
  }

  private assertValidDates(
    dates: EffectiveDates,
    config: CalendarConfig,
  ): void {
    if (!dates.startDateJson || !dates.datePrecision) return;

    if (
      !isValidTimelineDate(dates.startDateJson, dates.datePrecision, config)
    ) {
      throw new BadRequestException(
        "Start date is not valid for this campaign's calendar",
      );
    }
    if (dates.endDateJson) {
      if (
        !isValidTimelineDate(dates.endDateJson, dates.datePrecision, config)
      ) {
        throw new BadRequestException(
          "End date is not valid for this campaign's calendar",
        );
      }
      if (
        compareTimelineDates(dates.startDateJson, dates.endDateJson, config) > 0
      ) {
        throw new BadRequestException(
          'End date cannot be before the start date',
        );
      }
    }
  }

  private assertCanManage(membership: CampaignMembership): void {
    if (!this.policy.canManageTimeline(membership.role)) {
      throw new ForbiddenException(
        'You cannot manage timeline events in this campaign',
      );
    }
  }
}

function intersectFilter(
  current: Set<string> | null,
  ids: string[],
): Set<string> {
  const next = new Set(ids);
  if (current === null) return next;
  return new Set([...current].filter((id) => next.has(id)));
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Undated events (no `startDateJson`) always sort after every dated
 * event, ordered among themselves by creation order — the "Undated"
 * section. Dated events sort by calendar ordinal (`compareTimelineDates`). */
function compareEventRows(
  a: TimelineEventRow,
  b: TimelineEventRow,
  config: CalendarConfig,
): number {
  const aDated = a.startDateJson !== null;
  const bDated = b.startDateJson !== null;
  if (aDated && !bDated) return -1;
  if (!aDated && bDated) return 1;
  if (!aDated && !bDated) {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  return compareTimelineDates(
    a.startDateJson as TimelineDate,
    b.startDateJson as TimelineDate,
    config,
  );
}

/** Roadmap §14.2 weights: title=A, summary=B, content=C. Single vector, not
 * a public/gm pair — timeline events have no GM-only sub-content, only the
 * row-level `visibility` column (same access model as maps). */
function buildTimelineEventSearchVector(fields: {
  title: string;
  summary: string | null;
  contentJson: TiptapDoc | null;
}): SQL {
  return buildWeightedTsvector({
    a: [fields.title],
    b: [fields.summary ?? ''],
    c: [extractPlainText(fields.contentJson)],
  });
}

function toSummary(event: TimelineEventRow): TimelineEventSummary {
  return {
    id: event.id,
    campaignId: event.campaignId,
    title: event.title,
    summary: event.summary,
    startDateJson: event.startDateJson as TimelineDate | null,
    endDateJson: event.endDateJson as TimelineDate | null,
    datePrecision: event.datePrecision,
    visibility: event.visibility,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

/** Tags aren't fetched here — mirrors `PlotThreadsService`'s
 * `toEntitySummary`, same "panel doesn't render them" simplification. */
function toEntitySummary(entity: EntityRow): EntitySummary {
  return {
    id: entity.id,
    campaignId: entity.campaignId,
    entityType: entity.entityType,
    name: entity.name,
    slug: entity.slug,
    summary: entity.summary,
    aliases: (entity.aliasesJson as string[] | null) ?? [],
    tags: [],
    status: entity.status,
    visibility: entity.visibility,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
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
