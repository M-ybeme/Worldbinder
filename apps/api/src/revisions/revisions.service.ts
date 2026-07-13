import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntityVisibility,
  RevisionResourceType,
  RevisionSummary,
  TiptapDoc,
} from '@worldbinder/contracts';
import { and, desc, eq } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  entities,
  plotThreads,
  resourceRevisions,
  sessions,
  users,
} from '../database/schema';
import {
  entitySnapshotToUpdateInput,
  EntitiesService,
} from '../entities/entities.service';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import {
  plotThreadSnapshotToUpdateInput,
  PlotThreadsService,
} from '../plot-threads/plot-threads.service';
import {
  sessionSnapshotToUpdateInput,
  SessionsService,
} from '../sessions/sessions.service';
import { extractPlainText } from '../search/search-vector.util';

type ResourceRevisionRow = typeof resourceRevisions.$inferSelect;

interface LiveResourceState {
  visibility: EntityVisibility;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Fields worth extracting plain text from for the frontend's field-level
 * diff, per resource type — mirrors each service's own weighted-vector
 * field list (`search-vector.util.ts` callers), not the roadmap's search
 * weights themselves. */
const CONTENT_FIELDS: Record<RevisionResourceType, string[]> = {
  entity: ['publicContentJson', 'gmContentJson'],
  session: ['recapContentJson', 'plannedContentJson', 'gmContentJson'],
  plot_thread: ['publicContentJson', 'gmContentJson'],
};

@Injectable()
export class RevisionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly entities: EntitiesService,
    private readonly sessions: SessionsService,
    private readonly plotThreads: PlotThreadsService,
    private readonly audit: CampaignAuditService,
  ) {}

  /** Gated by the *current* live resource's visibility (roadmap §13.1:
   * "revision history must follow the current resource permission
   * policy"), read directly from the owning table — same "read a sibling
   * table directly" precedent as `campaigns.service.ts`'s dashboard,
   * avoiding the need to inject the full owning service just for this.
   * Deliberately does NOT filter out soft-deleted resources: history stays
   * viewable at its last-known visibility after deletion (matching
   * history's own audit purpose) — only `restore()` cares about
   * `deletedAt`. */
  async list(
    campaignId: string,
    resourceType: RevisionResourceType,
    resourceId: string,
    membership: CampaignMembership,
  ): Promise<RevisionSummary[]> {
    const live = await this.getLiveResourceState(
      campaignId,
      resourceType,
      resourceId,
    );
    if (!live) throw new NotFoundException('Resource not found');

    const canSee = this.policy.canViewVisibility(
      live.visibility,
      membership.role,
      membership.editorSecretAccess,
    );
    if (!canSee) throw new NotFoundException('Resource not found');

    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const rows = await this.db
      .select({
        revision: resourceRevisions,
        createdByDisplayName: users.displayName,
      })
      .from(resourceRevisions)
      .leftJoin(users, eq(users.id, resourceRevisions.createdByUserId))
      .where(
        and(
          eq(resourceRevisions.campaignId, campaignId),
          eq(resourceRevisions.resourceType, resourceType),
          eq(resourceRevisions.resourceId, resourceId),
        ),
      )
      .orderBy(desc(resourceRevisions.revisionNumber));

    return rows.map((row) =>
      toRevisionSummary(row.revision, row.createdByDisplayName, canViewGm),
    );
  }

  /** Replays the snapshot through the resource's own real `update()` (not
   * a raw table write) so restore gets tag sync / wiki-link refresh /
   * join-table full-replace sync / tsvector rebuild / permission checks
   * for free — see the module doc comment on why this needs
   * `EntitiesModule`/`SessionsModule`/`PlotThreadsModule` imported here
   * rather than the reverse. */
  async restore(
    campaignId: string,
    revisionId: string,
    membership: CampaignMembership,
    userId: string,
  ): Promise<void> {
    const [revision] = await this.db
      .select()
      .from(resourceRevisions)
      .where(
        and(
          eq(resourceRevisions.id, revisionId),
          eq(resourceRevisions.campaignId, campaignId),
        ),
      );
    if (!revision) throw new NotFoundException('Revision not found');

    const live = await this.getLiveResourceState(
      campaignId,
      revision.resourceType,
      revision.resourceId,
    );
    if (!live) throw new NotFoundException('Resource not found');
    if (live.deletedAt !== null) {
      throw new ConflictException(
        'Cannot restore a revision onto a deleted resource',
      );
    }

    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const snapshot = revision.snapshotJson as Record<string, unknown>;
    const updatedAt = live.updatedAt.toISOString();
    const changeSummary = `Restored from revision #${revision.revisionNumber}`;
    // Restore must always create a distinct revision, never merge into the
    // restoring actor's own recent autosave window — see
    // `RevisionRecorderService`'s `allowMerge` doc comment.
    const revisionOptions = { allowMerge: false, changeSummary };

    switch (revision.resourceType) {
      case 'entity':
        await this.entities.update(
          campaignId,
          revision.resourceId,
          membership,
          userId,
          entitySnapshotToUpdateInput(snapshot, canViewGm, updatedAt),
          revisionOptions,
        );
        break;
      case 'session':
        await this.sessions.update(
          campaignId,
          revision.resourceId,
          membership,
          userId,
          sessionSnapshotToUpdateInput(snapshot, canViewGm, updatedAt),
          revisionOptions,
        );
        break;
      case 'plot_thread':
        await this.plotThreads.update(
          campaignId,
          revision.resourceId,
          membership,
          userId,
          plotThreadSnapshotToUpdateInput(snapshot, canViewGm, updatedAt),
          revisionOptions,
        );
        break;
    }

    await this.audit.record({
      campaignId,
      type: 'revision_restored',
      actorUserId: userId,
      targetResourceType: revision.resourceType,
      targetResourceId: revision.resourceId,
      metadata: {
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
      },
    });
  }

  private async getLiveResourceState(
    campaignId: string,
    resourceType: RevisionResourceType,
    resourceId: string,
  ): Promise<LiveResourceState | null> {
    switch (resourceType) {
      case 'entity': {
        const [row] = await this.db
          .select({
            visibility: entities.visibility,
            updatedAt: entities.updatedAt,
            deletedAt: entities.deletedAt,
          })
          .from(entities)
          .where(
            and(
              eq(entities.id, resourceId),
              eq(entities.campaignId, campaignId),
            ),
          );
        return row ?? null;
      }
      case 'session': {
        const [row] = await this.db
          .select({
            visibility: sessions.visibility,
            updatedAt: sessions.updatedAt,
            deletedAt: sessions.deletedAt,
          })
          .from(sessions)
          .where(
            and(
              eq(sessions.id, resourceId),
              eq(sessions.campaignId, campaignId),
            ),
          );
        return row ?? null;
      }
      case 'plot_thread': {
        const [row] = await this.db
          .select({
            visibility: plotThreads.visibility,
            updatedAt: plotThreads.updatedAt,
            deletedAt: plotThreads.deletedAt,
          })
          .from(plotThreads)
          .where(
            and(
              eq(plotThreads.id, resourceId),
              eq(plotThreads.campaignId, campaignId),
            ),
          );
        return row ?? null;
      }
    }
  }
}

function toRevisionSummary(
  revision: ResourceRevisionRow,
  createdByDisplayName: string | null,
  canViewGm: boolean,
): RevisionSummary {
  const snapshot = revision.snapshotJson as Record<string, unknown>;
  const redacted = canViewGm
    ? snapshot
    : redactSnapshot(revision.resourceType, snapshot);

  return {
    id: revision.id,
    resourceType: revision.resourceType,
    resourceId: revision.resourceId,
    revisionNumber: revision.revisionNumber,
    snapshotJson: withPlainTextExtracts(revision.resourceType, redacted),
    changeSummary: revision.changeSummary,
    createdByUserId: revision.createdByUserId,
    createdByDisplayName,
    createdAt: revision.createdAt.toISOString(),
  };
}

/** Field-omission for non-GM revision viewers (roadmap §13.2/§13.1) —
 * snapshots are always stored GM-inclusive; this strips the GM-only keys
 * per resource type at read time, mirroring each service's own `toDetail()`
 * GM-gating spread. */
function redactSnapshot(
  resourceType: RevisionResourceType,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...snapshot };
  delete clone.gmContentJson;
  if (resourceType === 'session') delete clone.plannedContentJson;
  return clone;
}

/** Adds `<field>PlainText` alongside each content field so the frontend
 * never needs to walk TipTap JSON to render a diff — `extractPlainText`
 * is backend-only (`apps/web` can't import from `apps/api`), so this is
 * computed here rather than duplicated or promoted to a shared package
 * for one read endpoint. */
function withPlainTextExtracts(
  resourceType: RevisionResourceType,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...snapshot };
  for (const field of CONTENT_FIELDS[resourceType]) {
    if (!(field in result)) continue;
    result[`${field}PlainText`] = extractPlainText(
      result[field] as TiptapDoc | null,
    );
  }
  return result;
}
