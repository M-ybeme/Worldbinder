import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignImportSummary,
  PresignedImportUploadResponse,
} from '@worldbinder/contracts';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type Database } from '../database/database.module';
import { campaignImports } from '../database/schema';
import { ImportQueueService } from '../jobs/import-queue.service';
import { StorageService } from '../storage/storage.service';

type CampaignImportRow = typeof campaignImports.$inferSelect;

// Not campaign-scoped (importing *creates* a campaign) — the only sensible
// authorization model is "you can only see/act on your own import jobs",
// so every method scopes its lookup by the requesting user's id rather
// than a campaign membership guard.
@Injectable()
export class ImportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly queue: ImportQueueService,
  ) {}

  // The size cap is enforced by presignImportSchema at the controller's
  // ZodValidationPipe — the declared filename/size aren't persisted
  // anywhere (no import-history list view exists yet to show them).
  async presign(userId: string): Promise<PresignedImportUploadResponse> {
    const id = randomUUID();
    const storageKey = `imports/${id}.zip`;

    await this.db.insert(campaignImports).values({
      id,
      createdByUserId: userId,
      status: 'pending',
      archiveStorageKey: storageKey,
    });

    const { uploadUrl, expiresAt } =
      await this.storage.presignUpload(storageKey);
    return { importId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  }

  async complete(
    importId: string,
    userId: string,
  ): Promise<CampaignImportSummary> {
    const row = await this.requireOwnImport(importId, userId);
    if (row.status !== 'pending') {
      throw new ConflictException('Import upload was already completed');
    }

    const verifiedSize = await this.storage.headObjectSize(
      row.archiveStorageKey,
    );
    if (verifiedSize === null) {
      throw new BadRequestException(
        'Upload not found in storage — did the direct upload succeed?',
      );
    }

    const [updated] = await this.db
      .update(campaignImports)
      .set({ status: 'validating' })
      .where(eq(campaignImports.id, importId))
      .returning();
    if (!updated) throw new NotFoundException('Import not found');

    await this.queue.enqueueValidation(importId);

    return toSummary(updated);
  }

  async getById(
    importId: string,
    userId: string,
  ): Promise<CampaignImportSummary> {
    const row = await this.requireOwnImport(importId, userId);
    return toSummary(row);
  }

  async confirm(
    importId: string,
    userId: string,
  ): Promise<CampaignImportSummary> {
    const row = await this.requireOwnImport(importId, userId);
    if (row.status !== 'dry_run_ready') {
      throw new ConflictException('This import is not ready to be confirmed');
    }

    const [updated] = await this.db
      .update(campaignImports)
      .set({ status: 'importing' })
      .where(eq(campaignImports.id, importId))
      .returning();
    if (!updated) throw new NotFoundException('Import not found');

    await this.queue.enqueueRun(importId);

    return toSummary(updated);
  }

  private async requireOwnImport(
    importId: string,
    userId: string,
  ): Promise<CampaignImportRow> {
    const [row] = await this.db
      .select()
      .from(campaignImports)
      .where(
        and(
          eq(campaignImports.id, importId),
          eq(campaignImports.createdByUserId, userId),
        ),
      );
    if (!row) throw new NotFoundException('Import not found');
    return row;
  }
}

function toSummary(row: CampaignImportRow): CampaignImportSummary {
  return {
    id: row.id,
    status: row.status,
    dryRunReport: row.dryRunReportJson as CampaignImportSummary['dryRunReport'],
    importReport: row.importReportJson as CampaignImportSummary['importReport'],
    resultCampaignId: row.resultCampaignId,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
