import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AttachmentResourceType,
  AttachmentSummary,
  EntityVisibility,
  PresignedUploadResponse,
} from '@worldbinder/contracts';
import type {
  LinkAttachmentInput,
  PresignAttachmentInput,
} from '@worldbinder/validation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { CampaignAuditService } from '../audit/campaign-audit.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  attachments,
  entities,
  plotThreads,
  resourceAttachments,
  sessions,
  users,
} from '../database/schema';
import { AttachmentQueueService } from '../jobs/attachment-queue.service';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import type { CampaignMembership } from '../membership/guards/campaign-membership.guard';
import { StorageService } from '../storage/storage.service';

type AttachmentRow = typeof attachments.$inferSelect;

interface LiveResourceState {
  visibility: EntityVisibility;
  deletedAt: Date | null;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly policy: CampaignPolicyService,
    private readonly storage: StorageService,
    private readonly queue: AttachmentQueueService,
    private readonly audit: CampaignAuditService,
  ) {}

  async presign(
    campaignId: string,
    membership: CampaignMembership,
    userId: string,
    input: PresignAttachmentInput,
  ): Promise<PresignedUploadResponse> {
    this.assertCanManage(membership);

    const id = randomUUID();
    const storageKey = `attachments/${campaignId}/${id}`;

    await this.db.insert(attachments).values({
      id,
      campaignId,
      uploadedByUserId: userId,
      storageKey,
      originalFilename: sanitizeFilename(input.filename),
      sizeBytes: input.sizeBytes,
      status: 'pending',
    });

    const { uploadUrl, expiresAt } =
      await this.storage.presignUpload(storageKey);
    return { attachmentId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  }

  async complete(
    campaignId: string,
    attachmentId: string,
    membership: CampaignMembership,
  ): Promise<AttachmentSummary> {
    this.assertCanManage(membership);

    const attachment = await this.requireOwnAttachment(
      campaignId,
      attachmentId,
    );
    if (attachment.status !== 'pending') {
      throw new ConflictException('Attachment upload was already completed');
    }

    const verifiedSize = await this.storage.headObjectSize(
      attachment.storageKey,
    );
    if (verifiedSize === null) {
      throw new BadRequestException(
        'Upload not found in storage — did the direct upload succeed?',
      );
    }

    const [updated] = await this.db
      .update(attachments)
      .set({ status: 'uploaded', sizeBytes: verifiedSize })
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.campaignId, campaignId),
        ),
      )
      .returning();

    await this.queue.enqueueProcessing(attachmentId);

    return toSummary(updated, null, null);
  }

  /** Role-gated status check — backs the frontend's poll-until-ready step
   * between complete() (fires-and-forgets processing) and link()/the cover
   * image PATCH (which both require status 'ready'); the worker's
   * processing is asynchronous, so a client cannot assume ready
   * immediately after complete() returns. */
  async getById(
    campaignId: string,
    attachmentId: string,
    membership: CampaignMembership,
  ): Promise<AttachmentSummary> {
    this.assertCanManage(membership);
    const attachment = await this.requireOwnAttachment(
      campaignId,
      attachmentId,
    );
    return this.toSummaryWithDownloadUrl(attachment, null, null);
  }

  /** Gated purely by the live resource's current visibility — no
   * `@RequireCampaignRole` guard — same shape as
   * `RevisionsController.list()`/`RevisionsService.getLiveResourceState()`.
   * A viewer who can see resource A sees A's attachments regardless of
   * whether the same attachment is also linked to a resource B they can't
   * see, because they never issue a request in B's context. */
  async listForResource(
    campaignId: string,
    resourceType: AttachmentResourceType,
    resourceId: string,
    membership: CampaignMembership,
  ): Promise<AttachmentSummary[]> {
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

    const rows = await this.db
      .select({
        attachment: attachments,
        link: resourceAttachments,
        uploadedByDisplayName: users.displayName,
      })
      .from(resourceAttachments)
      .innerJoin(
        attachments,
        eq(attachments.id, resourceAttachments.attachmentId),
      )
      .leftJoin(users, eq(users.id, attachments.uploadedByUserId))
      .where(
        and(
          eq(resourceAttachments.resourceType, resourceType),
          eq(resourceAttachments.resourceId, resourceId),
          isNull(attachments.deletedAt),
        ),
      )
      .orderBy(
        resourceAttachments.displayOrder,
        desc(resourceAttachments.createdAt),
      );

    return Promise.all(
      rows.map((row) =>
        this.toSummaryWithDownloadUrl(
          row.attachment,
          row.uploadedByDisplayName,
          {
            caption: row.link.caption,
            displayOrder: row.link.displayOrder,
          },
        ),
      ),
    );
  }

  /** Role-gated management view (not a visibility check — an editing/picker
   * concern) for attachments uploaded to this campaign that aren't linked
   * to any resource yet, so the "attach an existing upload" picker flow has
   * something to list. */
  async listUnlinked(
    campaignId: string,
    membership: CampaignMembership,
  ): Promise<AttachmentSummary[]> {
    this.assertCanManage(membership);

    const rows = await this.db
      .select({
        attachment: attachments,
        uploadedByDisplayName: users.displayName,
      })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.uploadedByUserId))
      .leftJoin(
        resourceAttachments,
        eq(resourceAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(attachments.campaignId, campaignId),
          isNull(attachments.deletedAt),
          isNull(resourceAttachments.attachmentId),
        ),
      )
      .orderBy(desc(attachments.createdAt));

    return Promise.all(
      rows.map((row) =>
        this.toSummaryWithDownloadUrl(
          row.attachment,
          row.uploadedByDisplayName,
          null,
        ),
      ),
    );
  }

  async link(
    campaignId: string,
    attachmentId: string,
    membership: CampaignMembership,
    input: LinkAttachmentInput,
  ): Promise<void> {
    this.assertCanManage(membership);

    const attachment = await this.requireOwnAttachment(
      campaignId,
      attachmentId,
    );
    if (attachment.status !== 'ready') {
      throw new ConflictException('Attachment is not ready to be linked yet');
    }

    const live = await this.getLiveResourceState(
      campaignId,
      input.resourceType,
      input.resourceId,
    );
    if (!live || live.deletedAt !== null) {
      throw new BadRequestException(
        'Target resource not found in this campaign',
      );
    }

    await this.db
      .insert(resourceAttachments)
      .values({
        attachmentId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        caption: input.caption ?? null,
        displayOrder: input.displayOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: [
          resourceAttachments.attachmentId,
          resourceAttachments.resourceType,
          resourceAttachments.resourceId,
        ],
        set: {
          caption: input.caption ?? null,
          displayOrder: input.displayOrder ?? 0,
        },
      });
  }

  async unlink(
    campaignId: string,
    attachmentId: string,
    resourceType: AttachmentResourceType,
    resourceId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);
    await this.requireOwnAttachment(campaignId, attachmentId);

    await this.db
      .delete(resourceAttachments)
      .where(
        and(
          eq(resourceAttachments.attachmentId, attachmentId),
          eq(resourceAttachments.resourceType, resourceType),
          eq(resourceAttachments.resourceId, resourceId),
        ),
      );
  }

  async delete(
    campaignId: string,
    attachmentId: string,
    membership: CampaignMembership,
  ): Promise<void> {
    this.assertCanManage(membership);
    const attachment = await this.requireOwnAttachment(
      campaignId,
      attachmentId,
    );

    await this.db
      .update(attachments)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.campaignId, campaignId),
        ),
      );

    await this.storage.deleteObject(attachment.storageKey);

    await this.audit.record({
      campaignId,
      type: 'destructive_action',
      actorUserId: membership.userId,
      targetResourceType: 'attachment',
      targetResourceId: attachmentId,
      metadata: { action: 'delete' },
    });
  }

  private assertCanManage(membership: CampaignMembership): void {
    if (!this.policy.canManageAttachments(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to manage attachments',
      );
    }
  }

  private async requireOwnAttachment(
    campaignId: string,
    attachmentId: string,
  ): Promise<AttachmentRow> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.campaignId, campaignId),
        ),
      );
    if (!row) throw new NotFoundException('Attachment not found');
    return row;
  }

  private async toSummaryWithDownloadUrl(
    attachment: AttachmentRow,
    uploadedByDisplayName: string | null,
    link: { caption: string | null; displayOrder: number } | null,
  ): Promise<AttachmentSummary> {
    const downloadUrl =
      attachment.status === 'ready'
        ? await this.storage.presignDownload(
            attachment.storageKey,
            attachment.originalFilename,
          )
        : null;
    return toSummary(attachment, uploadedByDisplayName, downloadUrl, link);
  }

  private async getLiveResourceState(
    campaignId: string,
    resourceType: AttachmentResourceType,
    resourceId: string,
  ): Promise<LiveResourceState | null> {
    switch (resourceType) {
      case 'entity': {
        const [row] = await this.db
          .select({
            visibility: entities.visibility,
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

/** Strips path separators/control characters — display-only sanitization,
 * matches ALLOWED_ATTACHMENT_MIME_TYPES's spirit of never trusting raw
 * client input for anything security-relevant. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\\0\r\n]/g, '').slice(0, 255) || 'file';
}

function toSummary(
  attachment: AttachmentRow,
  uploadedByDisplayName: string | null,
  downloadUrl: string | null,
  link: { caption: string | null; displayOrder: number } | null = null,
): AttachmentSummary {
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    detectedMimeType: attachment.detectedMimeType,
    sizeBytes: attachment.sizeBytes,
    width: attachment.width,
    height: attachment.height,
    status: attachment.status,
    uploadedByUserId: attachment.uploadedByUserId,
    uploadedByDisplayName,
    createdAt: attachment.createdAt.toISOString(),
    caption: link?.caption ?? null,
    displayOrder: link?.displayOrder ?? 0,
    downloadUrl,
  };
}
