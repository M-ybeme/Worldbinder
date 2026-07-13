import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  resourceRevisions,
  type resourceRevisionTypeEnum,
} from '../database/schema';

export type ResourceRevisionType =
  (typeof resourceRevisionTypeEnum.enumValues)[number];

/** Not roadmap-specified — a documented judgment call for "how long an
 * editing session's autosaves stay grouped into one revision," same spirit
 * as plot-threads' `NEGLECT_THRESHOLD_SESSIONS`. */
export const REVISION_WINDOW_MINUTES = 30;

interface LatestRevisionInfo {
  createdByUserId: string | null;
  createdAt: Date;
}

/** "Group rapid autosaves into a revision window" (roadmap §15.1), factored
 * out of `recordRevision` so the boundary logic is unit-testable without a
 * database — same precedent as `plot-threads.service.ts`'s `isNeglected`.
 * Merging requires: caller opted in (`allowMerge` — restore always passes
 * `false`, so a restore never gets folded into the actor's own recent
 * autosave window), a prior revision exists, the same actor wrote it, and
 * it's still within the window measured from *that revision's own*
 * `createdAt` (not from the last merge) — a continuously-edited resource
 * closes its window on schedule rather than merging forever. */
export function shouldMergeRevision(
  latest: LatestRevisionInfo | undefined,
  actorUserId: string,
  allowMerge: boolean,
  now: Date = new Date(),
): boolean {
  if (!allowMerge || !latest) return false;
  if (latest.createdByUserId !== actorUserId) return false;
  const elapsedMs = now.getTime() - latest.createdAt.getTime();
  return elapsedMs <= REVISION_WINDOW_MINUTES * 60_000;
}

export interface RecordRevisionInput {
  campaignId: string;
  resourceType: ResourceRevisionType;
  resourceId: string;
  actorUserId: string;
  snapshot: Record<string, unknown>;
  changeSummary?: string | null;
  /** `false` when called from a restore — restore must always create a new,
   * distinct revision (roadmap exit criterion "Restore creates a new
   * revision"), never silently merge into the actor's own recent autosave
   * window. `true` for ordinary create()/update() calls. */
  allowMerge: boolean;
}

/** Optional extra param threaded through `EntitiesService`/`SessionsService`
 * /`PlotThreadsService`'s `update()` methods so `RevisionsService.restore()`
 * can force a distinct revision row (`allowMerge: false`) and attach a
 * human-readable summary, without those services needing to know anything
 * about revisions beyond "record one after this write." */
export interface RevisionWriteOptions {
  allowMerge?: boolean;
  changeSummary?: string;
}

@Injectable()
export class RevisionRecorderService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Takes `tx` as its first argument, same transactional-composition
   * convention as `WikiLinksService.refreshLinks`/`PlotThreadsService
   * .applySessionLink` — always called from inside the owning service's
   * existing `db.transaction()`, never opens its own.
   *
   * Immutability (§9.10: "existing revision rows are immutable") applies
   * to *closed* revisions — once a new window has started, nothing
   * rewrites it. The still-open accumulation row is expected to mutate
   * (`snapshotJson` overwritten in place) until its window closes; that's
   * the merge mechanism, not a violation of it. */
  async recordRevision(
    tx: Database,
    input: RecordRevisionInput,
  ): Promise<void> {
    const [latest] = await tx
      .select({
        id: resourceRevisions.id,
        revisionNumber: resourceRevisions.revisionNumber,
        createdByUserId: resourceRevisions.createdByUserId,
        createdAt: resourceRevisions.createdAt,
      })
      .from(resourceRevisions)
      .where(
        and(
          eq(resourceRevisions.campaignId, input.campaignId),
          eq(resourceRevisions.resourceType, input.resourceType),
          eq(resourceRevisions.resourceId, input.resourceId),
        ),
      )
      .orderBy(desc(resourceRevisions.revisionNumber))
      .limit(1);

    if (shouldMergeRevision(latest, input.actorUserId, input.allowMerge)) {
      await tx
        .update(resourceRevisions)
        .set({
          snapshotJson: input.snapshot,
          // Always set (not merged conditionally): a merge means this row
          // now represents a *different* batch of changes than whatever
          // summary it carried before (e.g. if it was previously merged
          // from a restore's "Restored from revision #N", a later plain
          // autosave edit should clear that stale description, not keep
          // describing an event that's no longer what this row reflects).
          changeSummary: input.changeSummary ?? null,
        })
        .where(eq(resourceRevisions.id, latest.id));
      return;
    }

    await tx.insert(resourceRevisions).values({
      campaignId: input.campaignId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      revisionNumber: (latest?.revisionNumber ?? 0) + 1,
      snapshotJson: input.snapshot,
      changeSummary: input.changeSummary ?? null,
      createdByUserId: input.actorUserId,
    });
  }
}
