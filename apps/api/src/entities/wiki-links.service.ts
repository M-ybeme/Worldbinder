import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  Backlink,
  EntitySummary,
  TiptapDoc,
} from '@worldbinder/contracts';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { entities, entityWikiLinks } from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';

type EntityRow = typeof entities.$inferSelect;
type WikiLinkSection = 'public' | 'gm';

interface ExtractedMention {
  entityId: string;
  displayText: string;
}

/** A minimal TipTap JSON node shape — only what extraction needs. */
interface TiptapNode {
  type?: string;
  attrs?: { entityId?: unknown; label?: unknown };
  content?: unknown[];
}

@Injectable()
export class WikiLinksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
  ) {}

  /** Walks a TipTap document collecting `entityMention` nodes
   * (`{ type: 'entityMention', attrs: { entityId, label } }`, inserted by
   * the `[[` autocomplete in `RichTextEditor`). */
  extractMentions(doc: TiptapDoc | null): ExtractedMention[] {
    if (!doc) return [];

    const results: ExtractedMention[] = [];
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const typed = node as TiptapNode;

      if (
        typed.type === 'entityMention' &&
        typeof typed.attrs?.entityId === 'string'
      ) {
        results.push({
          entityId: typed.attrs.entityId,
          displayText:
            typeof typed.attrs.label === 'string' ? typed.attrs.label : '',
        });
      }

      if (Array.isArray(typed.content)) {
        for (const child of typed.content) visit(child);
      }
    };

    visit(doc);
    return results;
  }

  /**
   * Full-replace sync of one entity's wiki-links for one content section —
   * same pattern as `EntitiesService`'s tag sync: drop the section's
   * existing rows and re-insert the current set, rather than diffing.
   *
   * Every mention target must resolve to a live entity in the same
   * campaign — a mention pointing across campaigns or at a since-deleted
   * entity is rejected outright at save time (roadmap: "protect against
   * cross-campaign links"), not silently dropped.
   */
  async refreshLinks(
    tx: Database,
    campaignId: string,
    entityId: string,
    section: WikiLinkSection,
    doc: TiptapDoc | null,
  ): Promise<void> {
    const mentions = this.extractMentions(doc);
    const displayTextByTarget = new Map<string, string>();
    for (const mention of mentions) {
      displayTextByTarget.set(mention.entityId, mention.displayText);
    }

    if (displayTextByTarget.size > 0) {
      const targetIds = [...displayTextByTarget.keys()];
      const validRows = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(
          and(
            inArray(entities.id, targetIds),
            eq(entities.campaignId, campaignId),
            isNull(entities.deletedAt),
          ),
        );
      const validIds = new Set(validRows.map((row) => row.id));
      const invalidIds = targetIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        throw new BadRequestException(
          'Content links to an entity that does not exist in this campaign',
        );
      }
    }

    await tx
      .delete(entityWikiLinks)
      .where(
        and(
          eq(entityWikiLinks.sourceResourceType, 'entity'),
          eq(entityWikiLinks.sourceResourceId, entityId),
          eq(entityWikiLinks.sourceSection, section),
        ),
      );

    if (displayTextByTarget.size === 0) return;

    await tx.insert(entityWikiLinks).values(
      [...displayTextByTarget.entries()].map(
        ([targetEntityId, displayText]) => ({
          campaignId,
          sourceResourceType: 'entity',
          sourceResourceId: entityId,
          sourceSection: section,
          targetEntityId,
          displayText,
        }),
      ),
    );
  }

  /** Incoming links to `entityId`, filtered so a hidden source entity or a
   * GM-only section a viewer can't read never surfaces (roadmap: "backlink
   * counts cannot leak hidden references"). */
  async backlinks(
    campaignId: string,
    entityId: string,
    membership: CampaignMembership,
  ): Promise<Backlink[]> {
    const rows = await this.db
      .select({ link: entityWikiLinks, source: entities })
      .from(entityWikiLinks)
      .innerJoin(entities, eq(entities.id, entityWikiLinks.sourceResourceId))
      .where(
        and(
          eq(entityWikiLinks.campaignId, campaignId),
          eq(entityWikiLinks.targetEntityId, entityId),
          eq(entityWikiLinks.sourceResourceType, 'entity'),
          isNull(entities.deletedAt),
        ),
      );

    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );

    const results: Backlink[] = [];
    for (const row of rows) {
      const canSeeSource = this.policy.canViewVisibility(
        row.source.visibility,
        membership.role,
        membership.editorSecretAccess,
      );
      if (!canSeeSource) continue;
      if (row.link.sourceSection === 'gm' && !canViewGm) continue;

      results.push({
        sourceEntity: toEntitySummary(row.source),
        section: row.link.sourceSection,
        displayText: row.link.displayText,
        createdAt: row.link.createdAt.toISOString(),
      });
    }
    return results;
  }
}

/** Tags aren't fetched for backlink source entities — the backlinks panel
 * doesn't render them. */
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
