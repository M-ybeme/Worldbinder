import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignSessionSummary,
  EntitySummary,
  EntityVisibility,
  PlayerFacingThreadStatus,
  PlotThreadDetail,
  PlotThreadImportance,
  PlotThreadSessionAction,
  PlotThreadStatus,
  PlotThreadSummary,
  TiptapDoc,
} from '@worldbinder/contracts';
import type {
  CreatePlotThreadInput,
  UpdatePlotThreadInput,
} from '@worldbinder/validation';
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  entities,
  plotThreadEntities,
  plotThreads,
  sessionPlotThreads,
  sessions,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import {
  RevisionRecorderService,
  type RevisionWriteOptions,
} from '../revisions/revision-recorder.service';
import {
  buildWeightedTsvector,
  extractPlainText,
} from '../search/search-vector.util';

type PlotThreadRow = typeof plotThreads.$inferSelect;
type EntityRow = typeof entities.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

/** §9.8's player-facing projection — computed, never a stored column, and
 * applied only after visibility has already gated whether a thread is
 * shown at all. */
export function projectPlayerFacingStatus(
  status: PlotThreadStatus,
): PlayerFacingThreadStatus {
  switch (status) {
    case 'foreshadowed':
      return 'open';
    case 'active':
    case 'dormant':
      return 'ongoing';
    case 'resolved':
      return 'completed';
    case 'abandoned':
      return 'open';
  }
}

export interface ResolvedSessionTransitionInput {
  currentStatus: PlotThreadStatus;
  currentResolvedSessionId: string | null;
}

/** "Plot-thread transitions" (an explicit §20.1 unit-test target): moving
 * *to* resolved records which session resolved it; moving *away from*
 * resolved clears that record, since it's no longer true. */
export function computeResolvedSessionTransition(
  current: ResolvedSessionTransitionInput,
  newStatus: PlotThreadStatus,
  sessionId: string | null,
): { resolvedSessionId: string | null } {
  if (newStatus === 'resolved' && current.currentStatus !== 'resolved') {
    return { resolvedSessionId: sessionId ?? current.currentResolvedSessionId };
  }
  if (newStatus !== 'resolved' && current.currentStatus === 'resolved') {
    return { resolvedSessionId: null };
  }
  return { resolvedSessionId: current.currentResolvedSessionId };
}

/** Not roadmap-specified — a documented judgment call for "hasn't been
 * touched in a while." */
export const NEGLECT_THRESHOLD_SESSIONS = 3;

export interface NeglectCheckInput {
  status: PlotThreadStatus;
  lastReferencedSessionNumber: number | null;
}

/** "Dormancy calculations" (roadmap §11.8). A thread that's already
 * resolved/abandoned isn't neglected, it's finished. A campaign with no
 * completed sessions yet has nothing to measure staleness against. */
export function isNeglected(
  thread: NeglectCheckInput,
  latestCompletedSessionNumber: number | null,
): boolean {
  if (thread.status === 'resolved' || thread.status === 'abandoned')
    return false;
  if (latestCompletedSessionNumber === null) return false;
  if (thread.lastReferencedSessionNumber === null) return true;
  return (
    latestCompletedSessionNumber - thread.lastReferencedSessionNumber >=
    NEGLECT_THRESHOLD_SESSIONS
  );
}

@Injectable()
export class PlotThreadsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly revisionRecorder: RevisionRecorderService,
    private readonly audit: CampaignAuditService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
    input: CreatePlotThreadInput,
  ): Promise<PlotThreadDetail> {
    this.assertCanManage(membership);
    this.assertCanWriteGmContent(membership, input.gmContentJson);

    const vectors = buildPlotThreadSearchVectors({
      title: input.title,
      summary: input.summary ?? null,
      publicContentJson: input.publicContentJson ?? null,
      gmContentJson: input.gmContentJson ?? null,
    });

    const threadId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(plotThreads)
        .values({
          campaignId,
          title: input.title,
          summary: input.summary ?? null,
          publicContentJson: input.publicContentJson ?? null,
          gmContentJson: input.gmContentJson ?? null,
          importance: input.importance ?? 'standard',
          visibility: input.visibility ?? 'public',
          createdByUserId: userId,
          updatedByUserId: userId,
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .returning();

      if (!row) throw new Error('Failed to create plot thread');

      if (input.entityIds) {
        await this.syncEntities(tx, campaignId, row.id, input.entityIds);
      }

      const entityIds = await this.getThreadEntityIds(tx, row.id);
      await this.revisionRecorder.recordRevision(tx, {
        campaignId,
        resourceType: 'plot_thread',
        resourceId: row.id,
        actorUserId: userId,
        snapshot: toPlotThreadRevisionSnapshot(row, entityIds),
        allowMerge: true,
      });

      return row.id;
    });

    return this.getById(campaignId, threadId, membership);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<PlotThreadSummary[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const conditions = [
      eq(plotThreads.campaignId, campaignId),
      isNull(plotThreads.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(plotThreads.visibility, 'public'));

    const [rows, latestCompleted] = await Promise.all([
      this.db
        .select({ thread: plotThreads, lastSession: sessions })
        .from(plotThreads)
        .leftJoin(
          sessions,
          eq(sessions.id, plotThreads.lastReferencedSessionId),
        )
        .where(and(...conditions))
        .orderBy(desc(plotThreads.updatedAt)),
      this.latestCompletedSessionNumber(campaignId),
    ]);

    return rows.map((row) =>
      this.toSummary(
        row.thread,
        row.lastSession,
        isNeglected(
          {
            status: row.thread.status,
            lastReferencedSessionNumber: row.lastSession?.sessionNumber ?? null,
          },
          latestCompleted,
        ),
        membership,
      ),
    );
  }

  async getById(
    campaignId: string,
    threadId: string,
    membership: CampaignMembership,
  ): Promise<PlotThreadDetail> {
    const thread = await this.requireVisibleThread(
      campaignId,
      threadId,
      membership,
    );
    return this.toDetail(thread, membership);
  }

  async update(
    campaignId: string,
    threadId: string,
    membership: CampaignMembership,
    userId: string,
    input: UpdatePlotThreadInput,
    revisionOptions?: RevisionWriteOptions,
  ): Promise<PlotThreadDetail> {
    this.assertCanManage(membership);
    this.assertCanWriteGmContent(membership, input.gmContentJson);

    const existing = await this.requireVisibleThread(
      campaignId,
      threadId,
      membership,
    );
    this.assertNotStale(existing, input.updatedAt);

    const statusChange =
      input.status !== undefined
        ? computeResolvedSessionTransition(
            {
              currentStatus: existing.status,
              currentResolvedSessionId: existing.resolvedSessionId,
            },
            input.status,
            null,
          )
        : undefined;

    // No join-table wrinkle here — every field the vector needs lives on
    // this row, so the merge can happen inline in the same `.set()` call.
    const vectors = buildPlotThreadSearchVectors({
      title: input.title !== undefined ? input.title : existing.title,
      summary: input.summary !== undefined ? input.summary : existing.summary,
      publicContentJson:
        input.publicContentJson !== undefined
          ? input.publicContentJson
          : (existing.publicContentJson as TiptapDoc | null),
      gmContentJson:
        input.gmContentJson !== undefined
          ? input.gmContentJson
          : (existing.gmContentJson as TiptapDoc | null),
    });

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(plotThreads)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.publicContentJson !== undefined
            ? { publicContentJson: input.publicContentJson }
            : {}),
          ...(input.gmContentJson !== undefined
            ? { gmContentJson: input.gmContentJson }
            : {}),
          ...(input.status !== undefined
            ? {
                status: input.status,
                resolvedSessionId: statusChange?.resolvedSessionId,
              }
            : {}),
          ...(input.importance !== undefined
            ? { importance: input.importance }
            : {}),
          ...(input.visibility !== undefined
            ? { visibility: input.visibility }
            : {}),
          updatedByUserId: userId,
          updatedAt: new Date(),
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .where(
          and(
            eq(plotThreads.id, threadId),
            eq(plotThreads.campaignId, campaignId),
            isNull(plotThreads.deletedAt),
          ),
        )
        .returning();

      if (!row) throw new NotFoundException('Plot thread not found');

      if (input.entityIds !== undefined) {
        await this.syncEntities(tx, campaignId, threadId, input.entityIds);
      }

      const entityIds = await this.getThreadEntityIds(tx, threadId);
      await this.revisionRecorder.recordRevision(tx, {
        campaignId,
        resourceType: 'plot_thread',
        resourceId: threadId,
        actorUserId: userId,
        snapshot: toPlotThreadRevisionSnapshot(row, entityIds),
        changeSummary: revisionOptions?.changeSummary,
        allowMerge: revisionOptions?.allowMerge ?? true,
      });
    });

    return this.getById(campaignId, threadId, membership);
  }

  async delete(
    campaignId: string,
    threadId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);

    const [updated] = await this.db
      .update(plotThreads)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(plotThreads.id, threadId),
          eq(plotThreads.campaignId, campaignId),
          isNull(plotThreads.deletedAt),
        ),
      )
      .returning({ id: plotThreads.id });

    if (!updated) throw new NotFoundException('Plot thread not found');

    await this.audit.record({
      campaignId,
      type: 'destructive_action',
      actorUserId: membership.userId,
      targetResourceType: 'plot_thread',
      targetResourceId: threadId,
      metadata: { action: 'delete' },
    });
  }

  /**
   * Called by `SessionsService` once per session-thread link that's new or
   * changed action (not re-applied on every unrelated session edit — see
   * roadmap notes). Runs inside the caller's transaction. `introduced` only
   * sets `introducedSessionId` the first time; any action bumps
   * `lastReferencedSessionId` if this session is more recent than what's
   * stored; `resolved` also flips status via the transition helper.
   * Deliberately not reversed if the link is later removed.
   */
  async applySessionLink(
    tx: Database,
    campaignId: string,
    plotThreadId: string,
    session: { id: string; sessionNumber: number },
    action: PlotThreadSessionAction,
  ): Promise<void> {
    const [thread] = await tx
      .select()
      .from(plotThreads)
      .where(
        and(
          eq(plotThreads.id, plotThreadId),
          eq(plotThreads.campaignId, campaignId),
          isNull(plotThreads.deletedAt),
        ),
      );
    if (!thread) throw new NotFoundException('Plot thread not found');

    const lastReferencedSessionNumber = thread.lastReferencedSessionId
      ? await this.sessionNumberFor(tx, thread.lastReferencedSessionId)
      : null;

    const updates: Partial<typeof plotThreads.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (action === 'introduced' && !thread.introducedSessionId) {
      updates.introducedSessionId = session.id;
    }
    if (
      lastReferencedSessionNumber === null ||
      session.sessionNumber > lastReferencedSessionNumber
    ) {
      updates.lastReferencedSessionId = session.id;
    }
    if (action === 'resolved') {
      const transition = computeResolvedSessionTransition(
        {
          currentStatus: thread.status,
          currentResolvedSessionId: thread.resolvedSessionId,
        },
        'resolved',
        session.id,
      );
      updates.status = 'resolved';
      updates.resolvedSessionId = transition.resolvedSessionId;
    }

    await tx
      .update(plotThreads)
      .set(updates)
      .where(eq(plotThreads.id, plotThreadId));
  }

  /** Backs `CampaignSessionDetail.plotThreadChanges`. `lastReferencedSession`
   * and `neglected` on the embedded summary are cheap placeholders (null /
   * false) rather than fully computed — this is a session-page embed, not
   * the thread list, and computing them here would mean an extra query per
   * linked thread for data the session page doesn't render. Same
   * simplification as `tags: []` on relationship/backlink entity summaries. */
  async listForSession(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
  ): Promise<
    { plotThread: PlotThreadSummary; action: PlotThreadSessionAction }[]
  > {
    const rows = await this.db
      .select({ thread: plotThreads, action: sessionPlotThreads.action })
      .from(sessionPlotThreads)
      .innerJoin(
        plotThreads,
        eq(plotThreads.id, sessionPlotThreads.plotThreadId),
      )
      .where(
        and(
          eq(sessionPlotThreads.sessionId, sessionId),
          eq(plotThreads.campaignId, campaignId),
          isNull(plotThreads.deletedAt),
        ),
      );

    const results: {
      plotThread: PlotThreadSummary;
      action: PlotThreadSessionAction;
    }[] = [];
    for (const row of rows) {
      if (
        !this.policy.canViewVisibility(
          row.thread.visibility,
          membership.role,
          membership.editorSecretAccess,
        )
      ) {
        continue;
      }
      results.push({
        plotThread: this.toSummary(row.thread, null, false, membership),
        action: row.action,
      });
    }
    return results;
  }

  private async toDetail(
    thread: PlotThreadRow,
    membership: CampaignMembership,
  ): Promise<PlotThreadDetail> {
    const [lastSessionRow] = thread.lastReferencedSessionId
      ? await this.db
          .select()
          .from(sessions)
          .where(eq(sessions.id, thread.lastReferencedSessionId))
      : [undefined];
    const latestCompleted = await this.latestCompletedSessionNumber(
      thread.campaignId,
    );
    const neglected = isNeglected(
      {
        status: thread.status,
        lastReferencedSessionNumber: lastSessionRow?.sessionNumber ?? null,
      },
      latestCompleted,
    );

    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const canSeeVisibility = (visibility: EntityRow['visibility']): boolean =>
      this.policy.canViewVisibility(
        visibility,
        membership.role,
        membership.editorSecretAccess,
      );

    const entityRows = await this.db
      .select({ entity: entities })
      .from(plotThreadEntities)
      .innerJoin(entities, eq(entities.id, plotThreadEntities.entityId))
      .where(
        and(
          eq(plotThreadEntities.plotThreadId, thread.id),
          isNull(entities.deletedAt),
        ),
      );

    const sessionRows = await this.db
      .select({ session: sessions, action: sessionPlotThreads.action })
      .from(sessionPlotThreads)
      .innerJoin(sessions, eq(sessions.id, sessionPlotThreads.sessionId))
      .where(
        and(
          eq(sessionPlotThreads.plotThreadId, thread.id),
          isNull(sessions.deletedAt),
        ),
      );

    return {
      ...this.toSummary(thread, lastSessionRow ?? null, neglected, membership),
      publicContentJson: thread.publicContentJson as TiptapDoc | null,
      ...(canViewGm
        ? { gmContentJson: thread.gmContentJson as TiptapDoc | null }
        : {}),
      entities: entityRows
        .map((r) => r.entity)
        .filter((e) => canSeeVisibility(e.visibility))
        .map(toEntitySummary),
      sessions: sessionRows
        .filter((r) => canSeeVisibility(r.session.visibility))
        .sort((a, b) => b.session.sessionNumber - a.session.sessionNumber)
        .map((r) => ({
          session: toSessionSummary(r.session),
          action: r.action,
        })),
    };
  }

  private async syncEntities(
    tx: Database,
    campaignId: string,
    plotThreadId: string,
    entityIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(entityIds));
    await tx
      .delete(plotThreadEntities)
      .where(eq(plotThreadEntities.plotThreadId, plotThreadId));
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
    const validIds = new Set(validRows.map((row) => row.id));
    const invalid = uniqueIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        'One or more related entities do not belong to this campaign',
      );
    }

    await tx
      .insert(plotThreadEntities)
      .values(uniqueIds.map((entityId) => ({ plotThreadId, entityId })));
  }

  /** Read fresh, inside the same `tx`, after `syncEntities` has run this
   * write — a plot-thread revision snapshot needs the current related-
   * entity set alongside its row columns, same reasoning as sessions'
   * `getSessionJoinState`. */
  private async getThreadEntityIds(
    tx: Database,
    plotThreadId: string,
  ): Promise<string[]> {
    const rows = await tx
      .select({ entityId: plotThreadEntities.entityId })
      .from(plotThreadEntities)
      .where(eq(plotThreadEntities.plotThreadId, plotThreadId));
    return rows.map((row) => row.entityId);
  }

  private async sessionNumberFor(
    tx: Database,
    sessionId: string,
  ): Promise<number | null> {
    const [row] = await tx
      .select({ sessionNumber: sessions.sessionNumber })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    return row?.sessionNumber ?? null;
  }

  private async latestCompletedSessionNumber(
    campaignId: string,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ max: sql<number | null>`max(${sessions.sessionNumber})` })
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          eq(sessions.status, 'completed'),
          isNull(sessions.deletedAt),
        ),
      );
    return row?.max ?? null;
  }

  private async requireThread(
    campaignId: string,
    threadId: string,
  ): Promise<PlotThreadRow> {
    const [thread] = await this.db
      .select()
      .from(plotThreads)
      .where(
        and(
          eq(plotThreads.id, threadId),
          eq(plotThreads.campaignId, campaignId),
          isNull(plotThreads.deletedAt),
        ),
      );
    if (!thread) throw new NotFoundException('Plot thread not found');
    return thread;
  }

  private async requireVisibleThread(
    campaignId: string,
    threadId: string,
    membership: CampaignMembership,
  ): Promise<PlotThreadRow> {
    const thread = await this.requireThread(campaignId, threadId);
    const canSee = this.policy.canViewVisibility(
      thread.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Plot thread not found');
    return thread;
  }

  private assertNotStale(existing: PlotThreadRow, updatedAt: string): void {
    if (existing.updatedAt.toISOString() !== updatedAt) {
      throw new ConflictException({
        code: 'STALE_UPDATE',
        message:
          'This plot thread was changed elsewhere. Reload to see the latest version.',
        currentUpdatedAt: existing.updatedAt.toISOString(),
      });
    }
  }

  private assertCanManage(membership: CampaignMembership): void {
    if (!this.policy.canManagePlotThreads(membership.role)) {
      throw new ForbiddenException(
        'You cannot manage plot threads in this campaign',
      );
    }
  }

  private assertCanWriteGmContent(
    membership: CampaignMembership,
    gmContentJson: unknown,
  ): void {
    if (
      gmContentJson !== undefined &&
      !this.policy.canViewGmContent(
        membership.role,
        membership.editorSecretAccess,
      )
    ) {
      throw new ForbiddenException(
        'You cannot edit GM-only content for this plot thread',
      );
    }
  }

  private toSummary(
    thread: PlotThreadRow,
    lastSession: SessionRow | null | undefined,
    neglected: boolean,
    membership: CampaignMembership,
  ): PlotThreadSummary {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

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
}

/** Builds both search-vector SQL expressions for a plot-thread row
 * (roadmap §14.2 weights: title=A, summary=B, content=C). `gm` additionally
 * folds in gmContentJson text; `public` never does — see the
 * `searchVectorPublic`/`searchVectorGm` column comments in
 * `database/schema.ts`. */
function buildPlotThreadSearchVectors(fields: {
  title: string;
  summary: string | null;
  publicContentJson: TiptapDoc | null;
  gmContentJson: TiptapDoc | null;
}): { public: SQL; gm: SQL } {
  const publicContentText = extractPlainText(fields.publicContentJson);
  const gmContentText = extractPlainText(fields.gmContentJson);
  const a = [fields.title];
  const b = [fields.summary ?? ''];

  return {
    public: buildWeightedTsvector({ a, b, c: [publicContentText] }),
    gm: buildWeightedTsvector({ a, b, c: [publicContentText, gmContentText] }),
  };
}

/** Always the full GM-inclusive shape plus related-entity ids (roadmap
 * §9.10) — unlike `toDetail()`, never gates `gmContentJson` by viewer.
 * Deliberately excludes the denormalized session-link fields
 * (`introducedSessionId`/`lastReferencedSessionId`/`resolvedSessionId`) —
 * those are managed by `applySessionLink`, not editable via `update()`,
 * and aren't part of `UpdatePlotThreadInput` for restore to map back to. */
function toPlotThreadRevisionSnapshot(
  thread: PlotThreadRow,
  entityIds: string[],
): Record<string, unknown> {
  return {
    title: thread.title,
    summary: thread.summary,
    publicContentJson: thread.publicContentJson,
    gmContentJson: thread.gmContentJson,
    status: thread.status,
    importance: thread.importance,
    visibility: thread.visibility,
    entityIds,
  };
}

/** Maps a stored snapshot back into an `UpdatePlotThreadInput` for
 * `RevisionsService.restore()`, reused rather than a raw table write so
 * restore gets related-entity full-replace sync, tsvector rebuild, and
 * permission checks for free. Same GM-field-omission rule as
 * `entitySnapshotToUpdateInput`. */
export function plotThreadSnapshotToUpdateInput(
  snapshot: Record<string, unknown>,
  canViewGm: boolean,
  updatedAt: string,
): UpdatePlotThreadInput {
  const s = snapshot as {
    title: string;
    summary: string | null;
    publicContentJson: TiptapDoc | null;
    gmContentJson: TiptapDoc | null;
    status: PlotThreadStatus;
    importance: PlotThreadImportance;
    visibility: EntityVisibility;
    entityIds: string[];
  };

  return {
    updatedAt,
    title: s.title,
    summary: s.summary ?? undefined,
    publicContentJson: s.publicContentJson ?? undefined,
    status: s.status,
    importance: s.importance,
    visibility: s.visibility,
    entityIds: s.entityIds,
    ...(canViewGm ? { gmContentJson: s.gmContentJson } : {}),
  };
}

/** Tags aren't fetched here — the plot-thread panels don't render them,
 * same simplification as the relationships/wiki-links/sessions modules. */
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
