import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AttachmentSummary,
  PresignedUploadResponse,
} from '@worldbinder/contracts';
import {
  attachmentResourceTypeSchema,
  linkAttachmentSchema,
  presignAttachmentSchema,
  type AttachmentResourceType,
  type LinkAttachmentInput,
  type PresignAttachmentInput,
} from '@worldbinder/validation';
import { CurrentUser } from '../auth/guards/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { AttachmentsService } from './attachments.service';

// list() has no @RequireCampaignRole — gated purely by the target
// resource's live visibility (§13.1), same shape as
// RevisionsController.list(). Every other route here manages the
// attachment itself, gated by canManageAttachments (owner/gm/editor).
@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post('presign')
  presign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(presignAttachmentSchema))
    body: PresignAttachmentInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PresignedUploadResponse> {
    return this.attachments.presign(campaignId, membership, user.sub, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':attachmentId/complete')
  complete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<AttachmentSummary> {
    return this.attachments.complete(campaignId, attachmentId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Get(':attachmentId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<AttachmentSummary> {
    return this.attachments.getById(campaignId, attachmentId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Get()
  listUnlinked(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<AttachmentSummary[]> {
    return this.attachments.listUnlinked(campaignId, membership);
  }

  @Get(':resourceType/:resourceId')
  listForResource(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('resourceType', new ZodValidationPipe(attachmentResourceTypeSchema))
    resourceType: AttachmentResourceType,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<AttachmentSummary[]> {
    return this.attachments.listForResource(
      campaignId,
      resourceType,
      resourceId,
      membership,
    );
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':attachmentId/link')
  link(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body(new ZodValidationPipe(linkAttachmentSchema))
    body: LinkAttachmentInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.attachments
      .link(campaignId, attachmentId, membership, body)
      .then(() => ({ message: 'Attachment linked' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':attachmentId/link/:resourceType/:resourceId')
  @HttpCode(HttpStatus.OK)
  unlink(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Param('resourceType', new ZodValidationPipe(attachmentResourceTypeSchema))
    resourceType: AttachmentResourceType,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.attachments
      .unlink(campaignId, attachmentId, resourceType, resourceId, membership)
      .then(() => ({ message: 'Attachment unlinked' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.attachments
      .delete(campaignId, attachmentId, membership)
      .then(() => ({ message: 'Attachment deleted' }));
  }
}
