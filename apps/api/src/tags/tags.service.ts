import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  entityTags,
  plotThreadTags,
  sessionTags,
  tags,
  timelineEventTags,
} from '../database/schema';

export interface CampaignTagSummary {
  id: string;
  name: string;
  usageCount: number;
}

const JUNCTION_TABLES = [
  {
    table: entityTags,
    resourceIdColumn: entityTags.entityId,
    tagIdColumn: entityTags.tagId,
  },
  {
    table: timelineEventTags,
    resourceIdColumn: timelineEventTags.timelineEventId,
    tagIdColumn: timelineEventTags.tagId,
  },
  {
    table: sessionTags,
    resourceIdColumn: sessionTags.sessionId,
    tagIdColumn: sessionTags.tagId,
  },
  {
    table: plotThreadTags,
    resourceIdColumn: plotThreadTags.plotThreadId,
    tagIdColumn: plotThreadTags.tagId,
  },
] as const;

/**
 * Shared tag-sync/lookup logic for every taggable resource (entities,
 * timeline events, sessions, plot threads) — consolidates what used to be
 * independently copy-pasted `normalizeTagName`/`syncTags` in
 * `EntitiesService` and `TimelineService`. The 4 `sync*Tags` methods stay
 * thin per-resource wrappers around one generic helper rather than a
 * single fully-dynamic method, since each junction table's resource-id
 * column has a different name — matching this codebase's existing
 * preference for explicit per-module code over cleverness.
 */
@Injectable()
export class TagsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  normalizeTagName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Full-replace sync: callers always submit the complete current tag
   * list, not a diff, so drop existing links and re-link rather than
   * diffing. Must run inside the caller's own transaction (`tx`) so tag
   * sync participates in the same atomic create/update it's part of. */
  private async syncTags(
    tx: Database,
    campaignId: string,
    junctionTable: PgTable,
    resourceIdColumn: PgColumn,
    resourceId: string,
    tagNames: string[],
    buildRow: (tagId: string) => Record<string, unknown>,
  ): Promise<void> {
    const uniqueNames = Array.from(
      new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
    );

    await tx.delete(junctionTable).where(eq(resourceIdColumn, resourceId));
    if (uniqueNames.length === 0) return;

    const tagIds: string[] = [];
    for (const name of uniqueNames) {
      const normalizedName = this.normalizeTagName(name);
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
      .insert(junctionTable)
      .values(tagIds.map((tagId) => buildRow(tagId)));
  }

  async syncEntityTags(
    tx: Database,
    campaignId: string,
    entityId: string,
    tagNames: string[],
  ): Promise<void> {
    return this.syncTags(
      tx,
      campaignId,
      entityTags,
      entityTags.entityId,
      entityId,
      tagNames,
      (tagId) => ({
        entityId,
        tagId,
      }),
    );
  }

  async syncTimelineEventTags(
    tx: Database,
    campaignId: string,
    timelineEventId: string,
    tagNames: string[],
  ): Promise<void> {
    return this.syncTags(
      tx,
      campaignId,
      timelineEventTags,
      timelineEventTags.timelineEventId,
      timelineEventId,
      tagNames,
      (tagId) => ({ timelineEventId, tagId }),
    );
  }

  async syncSessionTags(
    tx: Database,
    campaignId: string,
    sessionId: string,
    tagNames: string[],
  ): Promise<void> {
    return this.syncTags(
      tx,
      campaignId,
      sessionTags,
      sessionTags.sessionId,
      sessionId,
      tagNames,
      (tagId) => ({ sessionId, tagId }),
    );
  }

  async syncPlotThreadTags(
    tx: Database,
    campaignId: string,
    plotThreadId: string,
    tagNames: string[],
  ): Promise<void> {
    return this.syncTags(
      tx,
      campaignId,
      plotThreadTags,
      plotThreadTags.plotThreadId,
      plotThreadId,
      tagNames,
      (tagId) => ({ plotThreadId, tagId }),
    );
  }

  private async getTagsForResources(
    junctionTable: PgTable,
    resourceIdColumn: PgColumn,
    tagIdColumn: PgColumn,
    resourceIds: string[],
  ): Promise<Map<string, string[]>> {
    if (resourceIds.length === 0) return new Map();

    const rows = await this.db
      .select({ resourceId: resourceIdColumn, name: tags.name })
      .from(junctionTable)
      .innerJoin(tags, eq(tags.id, tagIdColumn))
      .where(inArray(resourceIdColumn, resourceIds));

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const resourceId = row.resourceId as string;
      const list = map.get(resourceId) ?? [];
      list.push(row.name);
      map.set(resourceId, list);
    }
    return map;
  }

  async getSessionTags(sessionIds: string[]): Promise<Map<string, string[]>> {
    return this.getTagsForResources(
      sessionTags,
      sessionTags.sessionId,
      sessionTags.tagId,
      sessionIds,
    );
  }

  async getPlotThreadTags(
    plotThreadIds: string[],
  ): Promise<Map<string, string[]>> {
    return this.getTagsForResources(
      plotThreadTags,
      plotThreadTags.plotThreadId,
      plotThreadTags.tagId,
      plotThreadIds,
    );
  }

  /** Every tag in a campaign with its total usage count across all 4
   * taggable resource types — merged in JS across 4 bounded per-table
   * queries, matching `search.service.ts`'s own established idiom
   * ("merge and re-sort in JS, not a cross-table UNION") rather than
   * introducing this codebase's first raw SQL UNION. */
  async listCampaignTags(campaignId: string): Promise<CampaignTagSummary[]> {
    const allTags = await this.db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.campaignId, campaignId));
    if (allTags.length === 0) return [];

    const tagIds = allTags.map((t) => t.id);
    const usageByTagId = new Map<string, number>();

    for (const { table, tagIdColumn } of JUNCTION_TABLES) {
      const rows = await this.db
        .select({ tagId: tagIdColumn, usageCount: count() })
        .from(table)
        .where(inArray(tagIdColumn, tagIds))
        .groupBy(tagIdColumn);
      for (const row of rows) {
        const tagId = row.tagId;
        usageByTagId.set(
          tagId,
          (usageByTagId.get(tagId) ?? 0) + Number(row.usageCount),
        );
      }
    }

    return allTags
      .map((t) => ({
        id: t.id,
        name: t.name,
        usageCount: usageByTagId.get(t.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async renameTag(
    campaignId: string,
    tagId: string,
    newName: string,
  ): Promise<void> {
    const trimmedName = newName.trim();
    if (!trimmedName) throw new BadRequestException('Tag name cannot be empty');
    const normalizedName = this.normalizeTagName(trimmedName);

    const [collision] = await this.db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.campaignId, campaignId),
          eq(tags.normalizedName, normalizedName),
        ),
      );
    if (collision && collision.id !== tagId) {
      throw new ConflictException('A tag with this name already exists');
    }

    const [updated] = await this.db
      .update(tags)
      .set({ name: trimmedName, normalizedName })
      .where(and(eq(tags.id, tagId), eq(tags.campaignId, campaignId)))
      .returning({ id: tags.id });
    if (!updated) throw new NotFoundException('Tag not found');
  }

  private async mergeJunction(
    tx: Database,
    junctionTable: PgTable,
    resourceIdColumn: PgColumn,
    tagIdColumn: PgColumn,
    sourceTagId: string,
    targetTagId: string,
    buildRow: (resourceId: string, tagId: string) => Record<string, unknown>,
  ): Promise<void> {
    const sourceRows = await tx
      .select({ resourceId: resourceIdColumn })
      .from(junctionTable)
      .where(eq(tagIdColumn, sourceTagId));
    if (sourceRows.length === 0) return;

    const resourceIds = sourceRows.map((row) => row.resourceId as string);
    const targetRows = await tx
      .select({ resourceId: resourceIdColumn })
      .from(junctionTable)
      .where(
        and(
          eq(tagIdColumn, targetTagId),
          inArray(resourceIdColumn, resourceIds),
        ),
      );
    const alreadyTargeted = new Set(
      targetRows.map((row) => row.resourceId as string),
    );

    // Resources already carrying both tags would violate the junction's
    // composite-unique constraint if the source row were simply
    // repointed — those source rows are dropped (the target tag already
    // covers them), everything else gets re-inserted under the target.
    const toRepoint = resourceIds.filter((id) => !alreadyTargeted.has(id));
    await tx.delete(junctionTable).where(eq(tagIdColumn, sourceTagId));
    if (toRepoint.length > 0) {
      await tx
        .insert(junctionTable)
        .values(
          toRepoint.map((resourceId) => buildRow(resourceId, targetTagId)),
        );
    }
  }

  async mergeTags(
    campaignId: string,
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void> {
    if (sourceTagId === targetTagId) {
      throw new BadRequestException('Cannot merge a tag into itself');
    }

    await this.db.transaction(async (tx) => {
      const [source] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, sourceTagId), eq(tags.campaignId, campaignId)));
      const [target] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, targetTagId), eq(tags.campaignId, campaignId)));
      if (!source || !target) throw new NotFoundException('Tag not found');

      await this.mergeJunction(
        tx,
        entityTags,
        entityTags.entityId,
        entityTags.tagId,
        sourceTagId,
        targetTagId,
        (entityId, tagId) => ({ entityId, tagId }),
      );
      await this.mergeJunction(
        tx,
        timelineEventTags,
        timelineEventTags.timelineEventId,
        timelineEventTags.tagId,
        sourceTagId,
        targetTagId,
        (timelineEventId, tagId) => ({ timelineEventId, tagId }),
      );
      await this.mergeJunction(
        tx,
        sessionTags,
        sessionTags.sessionId,
        sessionTags.tagId,
        sourceTagId,
        targetTagId,
        (sessionId, tagId) => ({ sessionId, tagId }),
      );
      await this.mergeJunction(
        tx,
        plotThreadTags,
        plotThreadTags.plotThreadId,
        plotThreadTags.tagId,
        sourceTagId,
        targetTagId,
        (plotThreadId, tagId) => ({ plotThreadId, tagId }),
      );

      await tx.delete(tags).where(eq(tags.id, sourceTagId));
    });
  }
}
