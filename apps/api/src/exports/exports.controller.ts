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
import type { CampaignExportSummary } from '@worldbinder/contracts';
import { CurrentUser } from '../auth/guards/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { ExportsService } from './exports.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@RequireCampaignRole('owner', 'gm')
@Controller('campaigns/:campaignId/exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignExportSummary> {
    return this.exports.create(campaignId, membership, user.sub);
  }

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignExportSummary[]> {
    return this.exports.list(campaignId, membership);
  }

  @Get(':exportId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('exportId', ParseUUIDPipe) exportId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignExportSummary> {
    return this.exports.getById(campaignId, exportId, membership);
  }
}
