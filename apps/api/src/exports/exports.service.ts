import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CampaignExportSummary } from '@worldbinder/contracts';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { campaignExports } from '../database/schema';
import { ExportQueueService } from '../jobs/export-queue.service';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { StorageService } from '../storage/storage.service';

type CampaignExportRow = typeof campaignExports.$inferSelect;

@Injectable()
export class ExportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly storage: StorageService,
    private readonly queue: ExportQueueService,
  ) {}

  async create(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
  ): Promise<CampaignExportSummary> {
    this.assertCanExport(membership);

    const [row] = await this.db
      .insert(campaignExports)
      .values({ campaignId, requestedByUserId: userId, status: 'pending' })
      .returning();
    if (!row) throw new Error('Failed to create export');

    await this.queue.enqueueExport(row.id);

    return this.toSummary(row);
  }

  async list(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<CampaignExportSummary[]> {
    this.assertCanExport(membership);

    const rows = await this.db
      .select()
      .from(campaignExports)
      .where(eq(campaignExports.campaignId, campaignId))
      .orderBy(desc(campaignExports.createdAt));

    return Promise.all(rows.map((row) => this.toSummary(row)));
  }

  async getById(
    campaignId: string,
    exportId: string,
    membership: CampaignMembership,
  ): Promise<CampaignExportSummary> {
    this.assertCanExport(membership);

    const [row] = await this.db
      .select()
      .from(campaignExports)
      .where(
        and(
          eq(campaignExports.id, exportId),
          eq(campaignExports.campaignId, campaignId),
        ),
      );
    if (!row) throw new NotFoundException('Export not found');

    return this.toSummary(row);
  }

  /** Freshly presigned per request (~15min expiry), only once `status`
   * is `'ready'` — same "never stored" pattern as attachment downloads. */
  private async toSummary(
    row: CampaignExportRow,
  ): Promise<CampaignExportSummary> {
    const downloadUrl =
      row.status === 'ready' && row.storageKey
        ? await this.storage.presignDownload(
            row.storageKey,
            `campaign-export-${row.id}.zip`,
          )
        : null;

    return {
      id: row.id,
      campaignId: row.campaignId,
      status: row.status,
      sizeBytes: row.sizeBytes,
      errorMessage: row.errorMessage,
      downloadUrl,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private assertCanExport(membership: CampaignMembership): void {
    if (!this.policy.canExportCampaign(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to export this campaign',
      );
    }
  }
}
