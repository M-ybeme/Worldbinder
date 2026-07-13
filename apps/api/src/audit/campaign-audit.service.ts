import { Inject, Injectable } from '@nestjs/common';
import type { CampaignAuditEvent } from '@worldbinder/contracts';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  campaignAuditEvents,
  type campaignAuditEventTypeEnum,
  users,
} from '../database/schema';

type CampaignAuditEventType =
  (typeof campaignAuditEventTypeEnum.enumValues)[number];

export interface RecordCampaignAuditEventInput {
  campaignId: string;
  type: CampaignAuditEventType;
  actorUserId: string | null;
  targetResourceType?: string;
  targetResourceId?: string;
  /** Structured details only — never content bodies (roadmap §11.14). */
  metadata?: Record<string, unknown>;
}

/** Campaign-scoped activity log — deliberately separate from
 * `AuditService`/`security_events` (auth-only, global, unchanged by this
 * milestone). No update/delete method exists here, and no controller ever
 * exposes a mutation route for this table — that omission is the entire
 * mechanism satisfying "audit records cannot be edited through normal
 * APIs" (roadmap Milestone 8 exit criterion), not an access-control check
 * that could be bypassed. */
@Injectable()
export class CampaignAuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(input: RecordCampaignAuditEventInput): Promise<void> {
    await this.db.insert(campaignAuditEvents).values({
      campaignId: input.campaignId,
      type: input.type,
      actorUserId: input.actorUserId,
      targetResourceType: input.targetResourceType ?? null,
      targetResourceId: input.targetResourceId ?? null,
      metadataJson: input.metadata ?? null,
    });
  }

  async list(
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<CampaignAuditEvent[]> {
    const rows = await this.db
      .select({
        event: campaignAuditEvents,
        actorDisplayName: users.displayName,
      })
      .from(campaignAuditEvents)
      .leftJoin(users, eq(users.id, campaignAuditEvents.actorUserId))
      .where(eq(campaignAuditEvents.campaignId, campaignId))
      .orderBy(desc(campaignAuditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.event.id,
      type: row.event.type,
      actorUserId: row.event.actorUserId,
      actorDisplayName: row.actorDisplayName,
      targetResourceType: row.event.targetResourceType,
      targetResourceId: row.event.targetResourceId,
      metadataJson: row.event.metadataJson as Record<string, unknown> | null,
      createdAt: row.event.createdAt.toISOString(),
    }));
  }
}
