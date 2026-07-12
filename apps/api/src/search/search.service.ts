import { Inject, Injectable } from '@nestjs/common';
import type {
  SearchResourceType,
  SearchResponse,
  SearchResult,
  SearchSnippet,
  TiptapDoc,
} from '@worldbinder/contracts';
import type { SearchQuery } from '@worldbinder/validation';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  entities,
  entityRelationships,
  plotThreads,
  relationshipTypes,
  sessions,
} from '../database/schema';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { extractPlainText } from './search-vector.util';

/** Ranking tiers, roadmap §14.3 — lower is better. Query-time tier
 * assignment mirrors the weighting used to build each `search_vector*`
 * column at write time (`search-vector.util.ts`). */
const TIER_EXACT_NAME = 1;
const TIER_EXACT_ALIAS = 2;
const TIER_NAME_PREFIX = 3;
const TIER_FUZZY_NAME = 4;
const TIER_TAG_SUMMARY = 5;
const TIER_CONTENT = 6;
const TIER_RELATIONSHIP = 7;

/** `pg_trgm` similarity threshold for the "fuzzy name" tier — a documented
 * judgment call, not roadmap-specified (same spirit as plot-threads'
 * `NEGLECT_THRESHOLD_SESSIONS`). */
const FUZZY_SIMILARITY_THRESHOLD = 0.2;

/** Each per-table query is bounded, then merged and re-sorted in JS
 * (`campaigns.service.ts`'s dashboard `recentActivity` merge is the
 * closest existing precedent for this shape) — not a cross-table UNION,
 * which nothing in this codebase currently uses. */
const PER_TABLE_LIMIT = 25;

interface RankedRow {
  tier: number;
  score: number;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
  ) {}

  async search(
    campaignId: string,
    membership: CampaignMembership,
    query: SearchQuery,
  ): Promise<SearchResponse> {
    const wantedTypes = new Set<SearchResourceType>(
      query.types ?? ['entity', 'session', 'plot_thread', 'relationship'],
    );
    const q = query.q.trim();

    const [entityResults, sessionResults, threadResults, relationshipResults] =
      await Promise.all([
        wantedTypes.has('entity')
          ? this.searchEntities(campaignId, membership, q)
          : Promise.resolve([]),
        wantedTypes.has('session')
          ? this.searchSessions(campaignId, membership, q)
          : Promise.resolve([]),
        wantedTypes.has('plot_thread')
          ? this.searchPlotThreads(campaignId, membership, q)
          : Promise.resolve([]),
        wantedTypes.has('relationship')
          ? this.searchRelationships(campaignId, membership, q)
          : Promise.resolve([]),
      ]);

    const merged = [
      ...entityResults,
      ...sessionResults,
      ...threadResults,
      ...relationshipResults,
    ].sort((a, b) => a.tier - b.tier || b.score - a.score);

    return {
      results: merged.slice(query.offset, query.offset + query.limit),
      total: merged.length,
    };
  }

  private async searchEntities(
    campaignId: string,
    membership: CampaignMembership,
    q: string,
  ): Promise<(SearchResult & RankedRow)[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const vectorColumn = canViewGm
      ? entities.searchVectorGm
      : entities.searchVectorPublic;

    const conditions = [
      eq(entities.campaignId, campaignId),
      isNull(entities.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(entities.visibility, 'public'));

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const aliasExists = sql`exists (select 1 from jsonb_array_elements_text(coalesce(${entities.aliasesJson}, '[]'::jsonb)) as alias where lower(alias) = lower(${q}))`;
    const prefixPattern = `${q}%`;

    const tierSql = sql<number>`(case
      when lower(${entities.name}) = lower(${q}) then ${TIER_EXACT_NAME}
      when ${aliasExists} then ${TIER_EXACT_ALIAS}
      when ${entities.name} ilike ${prefixPattern} then ${TIER_NAME_PREFIX}
      when similarity(${entities.name}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then ${TIER_FUZZY_NAME}
      when ts_rank_cd(array[0,0,1,0]::float4[], ${vectorColumn}, ${tsQuery}) > 0 then ${TIER_TAG_SUMMARY}
      else ${TIER_CONTENT}
    end)::int`;
    const scoreSql = sql<number>`case
      when lower(${entities.name}) = lower(${q}) or ${aliasExists} or ${entities.name} ilike ${prefixPattern} then 1
      when similarity(${entities.name}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then similarity(${entities.name}, ${q})
      else ts_rank_cd(${vectorColumn}, ${tsQuery})
    end`;
    const matchCondition = sql`(
      lower(${entities.name}) = lower(${q})
      or ${aliasExists}
      or ${entities.name} ilike ${prefixPattern}
      or similarity(${entities.name}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD}
      or ${vectorColumn} @@ ${tsQuery}
    )`;

    const rows = await this.db
      .select({
        id: entities.id,
        name: entities.name,
        entityType: entities.entityType,
        summary: entities.summary,
        publicContentJson: entities.publicContentJson,
        gmContentJson: entities.gmContentJson,
        tier: tierSql,
        score: scoreSql,
      })
      .from(entities)
      .where(and(...conditions, matchCondition))
      .orderBy(asc(tierSql), desc(scoreSql))
      .limit(PER_TABLE_LIMIT);

    return rows.map((row) => {
      const bodyText = [
        extractPlainText(row.publicContentJson as TiptapDoc | null),
        canViewGm
          ? extractPlainText(row.gmContentJson as TiptapDoc | null)
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      return {
        resourceType: 'entity' as const,
        id: row.id,
        title: row.name,
        subtitle: entityTypeLabel(row.entityType),
        snippet: buildSnippetForTier(row.tier, q, [
          row.summary ?? '',
          bodyText,
        ]),
        tier: Number(row.tier),
        score: Number(row.score),
      };
    });
  }

  private async searchSessions(
    campaignId: string,
    membership: CampaignMembership,
    q: string,
  ): Promise<(SearchResult & RankedRow)[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const vectorColumn = canViewGm
      ? sessions.searchVectorGm
      : sessions.searchVectorPublic;

    const conditions = [
      eq(sessions.campaignId, campaignId),
      isNull(sessions.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(sessions.visibility, 'public'));

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixPattern = `${q}%`;

    const tierSql = sql<number>`(case
      when lower(${sessions.title}) = lower(${q}) then ${TIER_EXACT_NAME}
      when ${sessions.title} ilike ${prefixPattern} then ${TIER_NAME_PREFIX}
      when similarity(${sessions.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then ${TIER_FUZZY_NAME}
      else ${TIER_CONTENT}
    end)::int`;
    const scoreSql = sql<number>`case
      when lower(${sessions.title}) = lower(${q}) or ${sessions.title} ilike ${prefixPattern} then 1
      when similarity(${sessions.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then similarity(${sessions.title}, ${q})
      else ts_rank_cd(${vectorColumn}, ${tsQuery})
    end`;
    const matchCondition = sql`(
      lower(${sessions.title}) = lower(${q})
      or ${sessions.title} ilike ${prefixPattern}
      or similarity(${sessions.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD}
      or ${vectorColumn} @@ ${tsQuery}
    )`;

    const rows = await this.db
      .select({
        id: sessions.id,
        title: sessions.title,
        sessionNumber: sessions.sessionNumber,
        recapContentJson: sessions.recapContentJson,
        plannedContentJson: sessions.plannedContentJson,
        gmContentJson: sessions.gmContentJson,
        tier: tierSql,
        score: scoreSql,
      })
      .from(sessions)
      .where(and(...conditions, matchCondition))
      .orderBy(asc(tierSql), desc(scoreSql))
      .limit(PER_TABLE_LIMIT);

    return rows.map((row) => {
      const bodyText = [
        extractPlainText(row.recapContentJson as TiptapDoc | null),
        canViewGm
          ? extractPlainText(row.plannedContentJson as TiptapDoc | null)
          : '',
        canViewGm
          ? extractPlainText(row.gmContentJson as TiptapDoc | null)
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      return {
        resourceType: 'session' as const,
        id: row.id,
        title: row.title,
        subtitle: `Session ${row.sessionNumber}`,
        snippet: buildSnippetForTier(row.tier, q, [bodyText]),
        tier: Number(row.tier),
        score: Number(row.score),
      };
    });
  }

  private async searchPlotThreads(
    campaignId: string,
    membership: CampaignMembership,
    q: string,
  ): Promise<(SearchResult & RankedRow)[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const vectorColumn = canViewGm
      ? plotThreads.searchVectorGm
      : plotThreads.searchVectorPublic;

    const conditions = [
      eq(plotThreads.campaignId, campaignId),
      isNull(plotThreads.deletedAt),
    ];
    if (!canViewGm) conditions.push(eq(plotThreads.visibility, 'public'));

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixPattern = `${q}%`;

    const tierSql = sql<number>`(case
      when lower(${plotThreads.title}) = lower(${q}) then ${TIER_EXACT_NAME}
      when ${plotThreads.title} ilike ${prefixPattern} then ${TIER_NAME_PREFIX}
      when similarity(${plotThreads.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then ${TIER_FUZZY_NAME}
      when ts_rank_cd(array[0,0,1,0]::float4[], ${vectorColumn}, ${tsQuery}) > 0 then ${TIER_TAG_SUMMARY}
      else ${TIER_CONTENT}
    end)::int`;
    const scoreSql = sql<number>`case
      when lower(${plotThreads.title}) = lower(${q}) or ${plotThreads.title} ilike ${prefixPattern} then 1
      when similarity(${plotThreads.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD} then similarity(${plotThreads.title}, ${q})
      else ts_rank_cd(${vectorColumn}, ${tsQuery})
    end`;
    const matchCondition = sql`(
      lower(${plotThreads.title}) = lower(${q})
      or ${plotThreads.title} ilike ${prefixPattern}
      or similarity(${plotThreads.title}, ${q}) > ${FUZZY_SIMILARITY_THRESHOLD}
      or ${vectorColumn} @@ ${tsQuery}
    )`;

    const rows = await this.db
      .select({
        id: plotThreads.id,
        title: plotThreads.title,
        summary: plotThreads.summary,
        publicContentJson: plotThreads.publicContentJson,
        gmContentJson: plotThreads.gmContentJson,
        tier: tierSql,
        score: scoreSql,
      })
      .from(plotThreads)
      .where(and(...conditions, matchCondition))
      .orderBy(asc(tierSql), desc(scoreSql))
      .limit(PER_TABLE_LIMIT);

    return rows.map((row) => {
      const bodyText = [
        extractPlainText(row.publicContentJson as TiptapDoc | null),
        canViewGm
          ? extractPlainText(row.gmContentJson as TiptapDoc | null)
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      return {
        resourceType: 'plot_thread' as const,
        id: row.id,
        title: row.title,
        subtitle: 'Plot Thread',
        snippet: buildSnippetForTier(row.tier, q, [
          row.summary ?? '',
          bodyText,
        ]),
        tier: Number(row.tier),
        score: Number(row.score),
      };
    });
  }

  /** No anchor entity in a global search, unlike `RelationshipsService
   * .canSeeRow` (always called from an already-visible entity's page) —
   * so all three of the relationship's own visibility AND both endpoint
   * entities' visibility must be checked explicitly here (roadmap §14.5:
   * filter inside the query, not by ranking then dropping rows). */
  private async searchRelationships(
    campaignId: string,
    membership: CampaignMembership,
    q: string,
  ): Promise<(SearchResult & RankedRow)[]> {
    const canViewGm = this.policy.canViewGmContent(
      membership.role,
      membership.editorSecretAccess,
    );
    const sourceEntity = alias(entities, 'search_source_entity');
    const targetEntity = alias(entities, 'search_target_entity');

    const conditions = [
      eq(entityRelationships.campaignId, campaignId),
      isNull(sourceEntity.deletedAt),
      isNull(targetEntity.deletedAt),
    ];
    if (!canViewGm) {
      conditions.push(
        eq(entityRelationships.visibility, 'public'),
        eq(sourceEntity.visibility, 'public'),
        eq(targetEntity.visibility, 'public'),
      );
    }

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const matchCondition = sql`${entityRelationships.searchVector} @@ ${tsQuery}`;
    const scoreSql = sql<number>`ts_rank_cd(${entityRelationships.searchVector}, ${tsQuery})`;

    const rows = await this.db
      .select({
        id: entityRelationships.id,
        description: entityRelationships.description,
        sourceEntityId: entityRelationships.sourceEntityId,
        sourceEntityName: sourceEntity.name,
        targetEntityName: targetEntity.name,
        forwardLabel: relationshipTypes.forwardLabel,
        score: scoreSql,
      })
      .from(entityRelationships)
      .innerJoin(
        sourceEntity,
        eq(sourceEntity.id, entityRelationships.sourceEntityId),
      )
      .innerJoin(
        targetEntity,
        eq(targetEntity.id, entityRelationships.targetEntityId),
      )
      .innerJoin(
        relationshipTypes,
        eq(relationshipTypes.id, entityRelationships.relationshipTypeId),
      )
      .where(and(...conditions, matchCondition))
      .orderBy(desc(scoreSql))
      .limit(PER_TABLE_LIMIT);

    return rows.map((row) => ({
      resourceType: 'relationship' as const,
      id: row.id,
      title: `${row.sourceEntityName} → ${row.targetEntityName}`,
      subtitle: row.forwardLabel,
      snippet: buildSnippet(row.description ?? '', q),
      tier: TIER_RELATIONSHIP,
      score: Number(row.score),
      linkEntityId: row.sourceEntityId,
    }));
  }
}

function entityTypeLabel(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

/** Name-based tiers (1–4) don't need a separate snippet — the match is
 * already visible in the result's title. Content-based tiers (5+) build
 * one from whichever text source is most likely to contain the match,
 * trying each candidate in order until one actually does. */
function buildSnippetForTier(
  tier: number,
  q: string,
  candidates: string[],
): SearchSnippet | null {
  if (tier < TIER_TAG_SUMMARY) return null;
  for (const candidate of candidates) {
    const snippet = buildSnippet(candidate, q);
    if (snippet) return snippet;
  }
  return null;
}

/** Plain case-insensitive substring match with a fixed context window —
 * deliberately not `ts_headline()`: this codebase doesn't persist the raw
 * plain-text body anywhere (only the derived tsvector), and running this
 * over the handful of already-fetched, already-LIMITed result rows is far
 * cheaper than adding more storage just to feed `ts_headline`. Returns
 * offsets, never markup, so the frontend never needs
 * `dangerouslySetInnerHTML`. */
function buildSnippet(
  text: string,
  query: string,
  windowSize = 100,
): SearchSnippet | null {
  const trimmedQuery = query.trim();
  if (!text || !trimmedQuery) return null;

  const matchIndex = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (matchIndex === -1) return null;

  const start = Math.max(0, matchIndex - windowSize);
  const end = Math.min(
    text.length,
    matchIndex + trimmedQuery.length + windowSize,
  );
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';

  return {
    text: prefix + text.slice(start, end) + suffix,
    highlights: [
      [
        matchIndex - start + prefix.length,
        matchIndex - start + prefix.length + trimmedQuery.length,
      ],
    ],
  };
}
