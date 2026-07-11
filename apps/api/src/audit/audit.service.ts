import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../database/database.module';
import { securityEvents, type securityEventTypeEnum } from '../database/schema';

type SecurityEventType = (typeof securityEventTypeEnum.enumValues)[number];

export interface RecordSecurityEventInput {
  type: SecurityEventType;
  userId?: string | null;
  ipHash?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(input: RecordSecurityEventInput): Promise<void> {
    await this.db.insert(securityEvents).values({
      type: input.type,
      userId: input.userId ?? null,
      ipHash: input.ipHash ?? null,
      metadataJson: input.metadata ?? null,
    });
  }
}
