import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntitySummary,
  PlotThreadSessionAction,
  SessionParticipant,
  TiptapDoc,
  WorldDate,
} from '@worldbinder/contracts';
import type {
  CompleteSessionInput,
  CreateSessionInput,
  PlotThreadChangeInput,
  UpdateSessionInput,
} from '@worldbinder/validation';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  campaignMembers,
  campaigns,
  entities,
  plotThreads,
  sessionEntities,
  sessionLocations,
  sessionParticipants,
  sessionPlotThreads,
  sessionReveals,
  sessions,
  users,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { PlotThreadsService } from '../plot-threads/plot-threads.service';
import {
  buildWeightedTsvector,
  extractPlainText,
} from '../search/search-vector.util';

type SessionRow = typeof sessions.$inferSelect;
type EntityRow = typeof entities.$inferSelect;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly plotThreads: PlotThreadsService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
    input: CreateSessionInput,
  ): Promise<CampaignSessionDetail> {
    this.assertCanEdit(membership);

    const vectors = buildSessionSearchVectors({
      title: input.title,
      recapContentJson: null,
      plannedContentJson: input.plannedContentJson ?? null,
      gmContentJson: null,
    });

    const sessionId = await this.db.transaction(async (tx) => {
      const sessionNumber = await this.nextSessionNumber(tx, campaignId);

      const [row] = await tx
        .insert(sessions)
        .values({
          campaignId,
          sessionNumber,
          title: input.title,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          worldStartDateJson: input.worldStartDateJson ?? null,
          plannedContentJson: input.plannedContentJson ?? null,
          visibility: input.visibility ?? 'public',
          createdByUserId: userId,
          updatedByUserId: userId,
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .returning({ id: sessions.id });

      if (!row) throw new Error('Failed to create session');

      if (input.participantIds) {
        await this.syncParticipants(
          tx,
          campaignId,
          row.id,
          input.participantIds,
        );
      }
      if (input.featuredEntityIds) {
        await this.syncFeaturedEntities(
          tx,
          campaignId,
          row.id,
          input.featuredEntityIds,
        );
      }
      if (input.locationEntityIds) {
        await this.syncLocations(
          tx,
          campaignId,
          row.id,
          input.locationEntityIds,
        );
      }
      if (input.plotThreadChanges) {
        await this.syncPlotThreadChanges(
          tx,
          campaignId,
          row.id,
          sessionNumber,
          input.plotThreadChanges,
        );
      }

      return row.id;
    });

    return this.getById(campaignId, sessionId, membership);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<CampaignSessionSummary[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const conditions = [
      eq(sessions.campaignId, campaignId),
      isNull(sessions.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(sessions.visibility, 'public'));

    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(sql`${sessions.sessionNumber} desc`);

    return rows.map((row) => this.toSummary(row));
  }

  async getById(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
  ): Promise<CampaignSessionDetail> {
    const session = await this.requireVisibleSession(
      campaignId,
      sessionId,
      membership,
    );
    return this.toDetail(session, membership);
  }

  async update(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
    userId: string,
    input: UpdateSessionInput,
  ): Promise<CampaignSessionDetail> {
    this.assertCanEdit(membership);

    const existing = await this.requireVisibleSession(
      campaignId,
      sessionId,
      membership,
    );
    this.assertNotStale(existing, input.updatedAt);

    // No join-table wrinkle here (unlike entities' tags) — every field the
    // vector needs lives on this row, so the merge can happen inline in
    // the same `.set()` call below.
    const vectors = buildSessionSearchVectors({
      title: input.title !== undefined ? input.title : existing.title,
      recapContentJson:
        input.recapContentJson !== undefined
          ? input.recapContentJson
          : (existing.recapContentJson as TiptapDoc | null),
      plannedContentJson:
        input.plannedContentJson !== undefined
          ? input.plannedContentJson
          : (existing.plannedContentJson as TiptapDoc | null),
      gmContentJson:
        input.gmContentJson !== undefined
          ? input.gmContentJson
          : (existing.gmContentJson as TiptapDoc | null),
    });

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(sessions)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.scheduledAt !== undefined
            ? {
                scheduledAt: input.scheduledAt
                  ? new Date(input.scheduledAt)
                  : null,
              }
            : {}),
          ...(input.playedAt !== undefined
            ? { playedAt: input.playedAt ? new Date(input.playedAt) : null }
            : {}),
          ...(input.worldStartDateJson !== undefined
            ? { worldStartDateJson: input.worldStartDateJson }
            : {}),
          ...(input.worldEndDateJson !== undefined
            ? { worldEndDateJson: input.worldEndDateJson }
            : {}),
          ...(input.plannedContentJson !== undefined
            ? { plannedContentJson: input.plannedContentJson }
            : {}),
          ...(input.recapContentJson !== undefined
            ? { recapContentJson: input.recapContentJson }
            : {}),
          ...(input.gmContentJson !== undefined
            ? { gmContentJson: input.gmContentJson }
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
            eq(sessions.id, sessionId),
            eq(sessions.campaignId, campaignId),
            isNull(sessions.deletedAt),
          ),
        )
        .returning({ id: sessions.id });

      if (!row) throw new NotFoundException('Session not found');

      if (input.participantIds !== undefined) {
        await this.syncParticipants(
          tx,
          campaignId,
          sessionId,
          input.participantIds,
        );
      }
      if (input.featuredEntityIds !== undefined) {
        await this.syncFeaturedEntities(
          tx,
          campaignId,
          sessionId,
          input.featuredEntityIds,
        );
      }
      if (input.locationEntityIds !== undefined) {
        await this.syncLocations(
          tx,
          campaignId,
          sessionId,
          input.locationEntityIds,
        );
      }
      if (input.plotThreadChanges !== undefined) {
        await this.syncPlotThreadChanges(
          tx,
          campaignId,
          sessionId,
          existing.sessionNumber,
          input.plotThreadChanges,
        );
      }
    });

    return this.getById(campaignId, sessionId, membership);
  }

  async delete(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanEdit(membership);

    const [updated] = await this.db
      .update(sessions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    if (!updated) throw new NotFoundException('Session not found');
  }

  /**
   * The "atomically updates continuity data" exit criterion: status flips
   * to completed, recap/world-end-date are finalized, and — if a world-end
   * date is resolved (from this call or already stored) — the campaign's
   * current in-world date advances, all in one transaction. Completing an
   * already-completed session 409s rather than silently re-applying the
   * transition; this DB-level guard (not generic idempotency-key
   * middleware, which roadmap §18.4 mentions but nothing in this codebase
   * implements yet) is the actual protection against a double-submit.
   */
  async complete(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
    input: CompleteSessionInput,
  ): Promise<CampaignSessionDetail> {
    this.assertCanEdit(membership);

    const existing = await this.requireVisibleSession(
      campaignId,
      sessionId,
      membership,
    );
    this.assertNotStale(existing, input.updatedAt);

    if (existing.status === 'completed') {
      throw new ConflictException('This session has already been completed');
    }

    const worldEndDate =
      input.worldEndDateJson ?? (existing.worldEndDateJson as WorldDate | null);

    // Completion is the other write path (besides update()) that can set
    // recapContentJson — same merge-and-recompute treatment.
    const vectors = buildSessionSearchVectors({
      title: existing.title,
      recapContentJson:
        input.recapContentJson !== undefined
          ? input.recapContentJson
          : (existing.recapContentJson as TiptapDoc | null),
      plannedContentJson: existing.plannedContentJson as TiptapDoc | null,
      gmContentJson: existing.gmContentJson as TiptapDoc | null,
    });

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(sessions)
        .set({
          status: 'completed',
          ...(input.recapContentJson !== undefined
            ? { recapContentJson: input.recapContentJson }
            : {}),
          ...(input.worldEndDateJson !== undefined
            ? { worldEndDateJson: input.worldEndDateJson }
            : {}),
          playedAt: input.playedAt
            ? new Date(input.playedAt)
            : (existing.playedAt ?? new Date()),
          updatedAt: new Date(),
          searchVectorPublic: vectors.public,
          searchVectorGm: vectors.gm,
        })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.campaignId, campaignId),
            isNull(sessions.deletedAt),
          ),
        )
        .returning({ id: sessions.id });

      if (!row) throw new NotFoundException('Session not found');

      if (worldEndDate) {
        await tx
          .update(campaigns)
          .set({ currentWorldDateJson: worldEndDate, updatedAt: new Date() })
          .where(eq(campaigns.id, campaignId));
      }
    });

    return this.getById(campaignId, sessionId, membership);
  }

  /**
   * Standalone action, deliberately not folded into `complete` — a GM can
   * reveal something before, during, or well after the session it happened
   * in (roadmap §20.4 lists "Complete session" and "Reveal selected
   * information" as separate E2E steps). Rejecting an already-public
   * entity doubles as this endpoint's own idempotency guard.
   */
  async reveal(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
    entityId: string,
  ): Promise<EntitySummary> {
    this.assertCanReveal(membership);
    await this.requireSession(campaignId, sessionId);

    const [entity] = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    if (!entity) throw new NotFoundException('Entity not found');
    if (entity.visibility !== 'gm_only') {
      throw new BadRequestException(
        'This entity is already visible to players',
      );
    }

    const revealed = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(entities)
        .set({ visibility: 'public', updatedAt: new Date() })
        .where(eq(entities.id, entityId))
        .returning();
      if (!row) throw new Error('Failed to reveal entity');

      await tx.insert(sessionReveals).values({ sessionId, entityId });
      return row;
    });

    return toEntitySummary(revealed);
  }

  /** Every session (`session_entities`) or location (`session_locations`)
   * link for one entity, deduped and visibility-filtered — backs the
   * "Session Appearances" panel on the entity detail page. */
  async listForEntity(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<CampaignSessionSummary[]> {
    const featuredRows = await this.db
      .select({ session: sessions })
      .from(sessionEntities)
      .innerJoin(sessions, eq(sessions.id, sessionEntities.sessionId))
      .where(
        and(
          eq(sessionEntities.entityId, entityId),
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
        ),
      );
    const locationRows = await this.db
      .select({ session: sessions })
      .from(sessionLocations)
      .innerJoin(sessions, eq(sessions.id, sessionLocations.sessionId))
      .where(
        and(
          eq(sessionLocations.entityId, entityId),
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
        ),
      );

    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const byId = new Map<string, SessionRow>();
    for (const row of [...featuredRows, ...locationRows]) {
      if (row.session.visibility === 'gm_only' && !canViewGm) continue;
      byId.set(row.session.id, row.session);
    }

    return Array.from(byId.values())
      .sort((a, b) => b.sessionNumber - a.sessionNumber)
      .map((row) => this.toSummary(row));
  }

  private async nextSessionNumber(
    tx: Database,
    campaignId: string,
  ): Promise<number> {
    const [row] = await tx
      .select({ max: sql<number>`coalesce(max(${sessions.sessionNumber}), 0)` })
      .from(sessions)
      .where(eq(sessions.campaignId, campaignId));
    return Number(row?.max ?? 0) + 1;
  }

  private async syncParticipants(
    tx: Database,
    campaignId: string,
    sessionId: string,
    campaignMemberIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(campaignMemberIds));
    await tx
      .delete(sessionParticipants)
      .where(eq(sessionParticipants.sessionId, sessionId));
    if (uniqueIds.length === 0) return;

    const validRows = await tx
      .select({ id: campaignMembers.id })
      .from(campaignMembers)
      .where(
        and(
          inArray(campaignMembers.id, uniqueIds),
          eq(campaignMembers.campaignId, campaignId),
        ),
      );
    assertAllValid(
      uniqueIds,
      validRows,
      'One or more participants do not belong to this campaign',
    );

    await tx
      .insert(sessionParticipants)
      .values(
        uniqueIds.map((campaignMemberId) => ({ sessionId, campaignMemberId })),
      );
  }

  private async syncFeaturedEntities(
    tx: Database,
    campaignId: string,
    sessionId: string,
    entityIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(entityIds));
    await tx
      .delete(sessionEntities)
      .where(eq(sessionEntities.sessionId, sessionId));
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
    assertAllValid(
      uniqueIds,
      validRows,
      'One or more featured entities do not belong to this campaign',
    );

    await tx
      .insert(sessionEntities)
      .values(uniqueIds.map((entityId) => ({ sessionId, entityId })));
  }

  private async syncLocations(
    tx: Database,
    campaignId: string,
    sessionId: string,
    entityIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(entityIds));
    await tx
      .delete(sessionLocations)
      .where(eq(sessionLocations.sessionId, sessionId));
    if (uniqueIds.length === 0) return;

    const validRows = await tx
      .select({ id: entities.id, entityType: entities.entityType })
      .from(entities)
      .where(
        and(
          inArray(entities.id, uniqueIds),
          eq(entities.campaignId, campaignId),
          isNull(entities.deletedAt),
        ),
      );
    assertAllValid(
      uniqueIds,
      validRows,
      'One or more locations do not belong to this campaign',
    );

    const nonLocations = validRows.filter(
      (row) => row.entityType !== 'location',
    );
    if (nonLocations.length > 0) {
      throw new BadRequestException(
        'Only location entities can be added as session locations',
      );
    }

    await tx
      .insert(sessionLocations)
      .values(uniqueIds.map((entityId) => ({ sessionId, entityId })));
  }

  /** Full-replace sync like the other session join tables, plus a diff
   * against the *previous* set so `PlotThreadsService.applySessionLink`'s
   * side effects (denormalized session-id fields, resolved status) only
   * fire for links that are new or whose action changed — not re-applied
   * on every unrelated session edit. */
  private async syncPlotThreadChanges(
    tx: Database,
    campaignId: string,
    sessionId: string,
    sessionNumber: number,
    changes: PlotThreadChangeInput[],
  ): Promise<void> {
    const existingRows = await tx
      .select({
        plotThreadId: sessionPlotThreads.plotThreadId,
        action: sessionPlotThreads.action,
      })
      .from(sessionPlotThreads)
      .where(eq(sessionPlotThreads.sessionId, sessionId));
    const existingByThread = new Map<string, PlotThreadSessionAction>(
      existingRows.map((row) => [row.plotThreadId, row.action]),
    );

    const uniqueChanges = dedupePlotThreadChanges(changes);

    await tx
      .delete(sessionPlotThreads)
      .where(eq(sessionPlotThreads.sessionId, sessionId));

    if (uniqueChanges.length > 0) {
      const validRows = await tx
        .select({ id: plotThreads.id })
        .from(plotThreads)
        .where(
          and(
            inArray(
              plotThreads.id,
              uniqueChanges.map((change) => change.plotThreadId),
            ),
            eq(plotThreads.campaignId, campaignId),
            isNull(plotThreads.deletedAt),
          ),
        );
      assertAllValid(
        uniqueChanges.map((change) => change.plotThreadId),
        validRows,
        'One or more plot threads do not belong to this campaign',
      );

      await tx.insert(sessionPlotThreads).values(
        uniqueChanges.map((change) => ({
          sessionId,
          plotThreadId: change.plotThreadId,
          action: change.action,
        })),
      );
    }

    for (const change of uniqueChanges) {
      if (existingByThread.get(change.plotThreadId) === change.action) continue;
      await this.plotThreads.applySessionLink(
        tx,
        campaignId,
        change.plotThreadId,
        { id: sessionId, sessionNumber },
        change.action,
      );
    }
  }

  private async requireSession(
    campaignId: string,
    sessionId: string,
  ): Promise<SessionRow> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.campaignId, campaignId),
          isNull(sessions.deletedAt),
        ),
      );
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async requireVisibleSession(
    campaignId: string,
    sessionId: string,
    membership: CampaignMembership,
  ): Promise<SessionRow> {
    const session = await this.requireSession(campaignId, sessionId);
    const canSee = this.policy.canViewVisibility(
      session.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Session not found');
    return session;
  }

  private assertNotStale(existing: SessionRow, updatedAt: string): void {
    if (existing.updatedAt.toISOString() !== updatedAt) {
      throw new ConflictException({
        code: 'STALE_UPDATE',
        message:
          'This session was changed elsewhere. Reload to see the latest version.',
        currentUpdatedAt: existing.updatedAt.toISOString(),
      });
    }
  }

  private assertCanEdit(membership: CampaignMembership): void {
    if (!this.policy.canEditSessions(membership.role)) {
      throw new ForbiddenException(
        'You cannot manage sessions in this campaign',
      );
    }
  }

  private assertCanReveal(membership: CampaignMembership): void {
    if (!this.policy.canRevealContent(membership.role)) {
      throw new ForbiddenException(
        'You cannot reveal content in this campaign',
      );
    }
  }

  private toSummary(row: SessionRow): CampaignSessionSummary {
    return {
      id: row.id,
      campaignId: row.campaignId,
      sessionNumber: row.sessionNumber,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      playedAt: row.playedAt?.toISOString() ?? null,
      worldStartDateJson: row.worldStartDateJson as WorldDate | null,
      worldEndDateJson: row.worldEndDateJson as WorldDate | null,
      visibility: row.visibility,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toDetail(
    row: SessionRow,
    membership: CampaignMembership,
  ): Promise<CampaignSessionDetail> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const canSeeEntity = (entity: EntityRow): boolean =>
      this.policy.canViewVisibility(
        entity.visibility,
        membership.role,
        membership.editorSecretAccess,
      );

    const participantRows = await this.db
      .select({
        campaignMemberId: sessionParticipants.campaignMemberId,
        userId: campaignMembers.userId,
        displayName: users.displayName,
      })
      .from(sessionParticipants)
      .innerJoin(
        campaignMembers,
        eq(campaignMembers.id, sessionParticipants.campaignMemberId),
      )
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(eq(sessionParticipants.sessionId, row.id));

    const featuredRows = await this.db
      .select({ entity: entities })
      .from(sessionEntities)
      .innerJoin(entities, eq(entities.id, sessionEntities.entityId))
      .where(
        and(eq(sessionEntities.sessionId, row.id), isNull(entities.deletedAt)),
      );

    const locationRows = await this.db
      .select({ entity: entities })
      .from(sessionLocations)
      .innerJoin(entities, eq(entities.id, sessionLocations.entityId))
      .where(
        and(eq(sessionLocations.sessionId, row.id), isNull(entities.deletedAt)),
      );

    const revealRows = await this.db
      .select({ entity: entities })
      .from(sessionReveals)
      .innerJoin(entities, eq(entities.id, sessionReveals.entityId))
      .where(
        and(eq(sessionReveals.sessionId, row.id), isNull(entities.deletedAt)),
      );

    const participants: SessionParticipant[] = participantRows.map((p) => ({
      campaignMemberId: p.campaignMemberId,
      userId: p.userId,
      displayName: p.displayName,
    }));

    const plotThreadChanges = await this.plotThreads.listForSession(
      row.campaignId,
      row.id,
      membership,
    );

    return {
      ...this.toSummary(row),
      recapContentJson: row.recapContentJson as TiptapDoc | null,
      ...(canViewGm
        ? {
            plannedContentJson: row.plannedContentJson as TiptapDoc | null,
            gmContentJson: row.gmContentJson as TiptapDoc | null,
          }
        : {}),
      participants,
      featuredEntities: featuredRows
        .map((r) => r.entity)
        .filter(canSeeEntity)
        .map(toEntitySummary),
      locations: locationRows
        .map((r) => r.entity)
        .filter(canSeeEntity)
        .map(toEntitySummary),
      reveals: revealRows
        .map((r) => r.entity)
        .filter(canSeeEntity)
        .map(toEntitySummary),
      plotThreadChanges,
    };
  }
}

/** Builds both search-vector SQL expressions for a session row (roadmap
 * §14.2 weights: title=A, content=C — sessions have no summary/tags field,
 * so weight B is unused). `gm` additionally folds in plannedContentJson/
 * gmContentJson text; `public` never does — see the `searchVectorPublic`/
 * `searchVectorGm` column comments in `database/schema.ts`. */
function buildSessionSearchVectors(fields: {
  title: string;
  recapContentJson: TiptapDoc | null;
  plannedContentJson: TiptapDoc | null;
  gmContentJson: TiptapDoc | null;
}): { public: SQL; gm: SQL } {
  const recapText = extractPlainText(fields.recapContentJson);
  const plannedText = extractPlainText(fields.plannedContentJson);
  const gmText = extractPlainText(fields.gmContentJson);
  const a = [fields.title];

  return {
    public: buildWeightedTsvector({ a, c: [recapText] }),
    gm: buildWeightedTsvector({ a, c: [recapText, plannedText, gmText] }),
  };
}

/** Last write wins if the same plot thread appears twice in one submission. */
function dedupePlotThreadChanges(
  changes: PlotThreadChangeInput[],
): PlotThreadChangeInput[] {
  const map = new Map<string, PlotThreadSessionAction>();
  for (const change of changes) map.set(change.plotThreadId, change.action);
  return Array.from(map.entries()).map(([plotThreadId, action]) => ({
    plotThreadId,
    action,
  }));
}

function assertAllValid(
  requestedIds: string[],
  validRows: { id: string }[],
  message: string,
): void {
  const validIds = new Set(validRows.map((row) => row.id));
  const invalid = requestedIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) throw new BadRequestException(message);
}

/** Tags aren't fetched here — session panels don't render them, same
 * simplification as the relationships/wiki-links modules. */
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
