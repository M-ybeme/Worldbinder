import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { RevisionSummary } from '@worldbinder/contracts';
import {
  revisionResourceTypeSchema,
  type RevisionResourceType,
} from '@worldbinder/validation';
import { CurrentUser } from '../auth/guards/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { RevisionsService } from './revisions.service';

// No @RequireCampaignRole here — list() is gated by the live resource's own
// visibility (§13.1), and restore() delegates permission enforcement to
// the owning resource's real update() (assertCanEdit/assertCanWriteGmContent),
// same as any other write to that resource.
@UseGuards(JwtAuthGuard, CampaignMembershipGuard)
@Controller('campaigns/:campaignId/revisions')
export class RevisionsController {
  constructor(private readonly revisions: RevisionsService) {}

  @Get(':resourceType/:resourceId')
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('resourceType', new ZodValidationPipe(revisionResourceTypeSchema))
    resourceType: RevisionResourceType,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<RevisionSummary[]> {
    return this.revisions.list(
      campaignId,
      resourceType,
      resourceId,
      membership,
    );
  }

  @Post(':revisionId/restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ message: string }> {
    await this.revisions.restore(campaignId, revisionId, membership, user.sub);
    return { message: 'Revision restored' };
  }
}
