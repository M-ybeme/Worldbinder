import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CampaignDetail, CampaignSummary } from '@worldbinder/contracts';
import {
  createCampaignSchema,
  updateCampaignSchema,
  type CreateCampaignInput,
  type UpdateCampaignInput,
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
import { CampaignsService } from './campaigns.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<CampaignSummary[]> {
    return this.campaigns.list(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createCampaignSchema))
    body: CreateCampaignInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignDetail> {
    return this.campaigns.create(user.sub, body);
  }

  @UseGuards(CampaignMembershipGuard)
  @Get(':campaignId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignDetail> {
    return this.campaigns.getById(campaignId, membership);
  }

  @UseGuards(CampaignMembershipGuard)
  @Patch(':campaignId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(updateCampaignSchema))
    body: UpdateCampaignInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignDetail> {
    return this.campaigns.update(campaignId, membership, body);
  }

  @UseGuards(CampaignMembershipGuard, CampaignRolesGuard)
  @RequireCampaignRole('owner')
  @Delete(':campaignId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.campaigns
      .delete(campaignId, membership)
      .then(() => ({ message: 'Campaign deleted' }));
  }

  @UseGuards(CampaignMembershipGuard, CampaignRolesGuard)
  @RequireCampaignRole('owner', 'gm')
  @Post(':campaignId/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.campaigns
      .archive(campaignId, membership)
      .then(() => ({ message: 'Campaign archived' }));
  }

  @UseGuards(CampaignMembershipGuard, CampaignRolesGuard)
  @RequireCampaignRole('owner', 'gm')
  @Post(':campaignId/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.campaigns
      .restore(campaignId, membership)
      .then(() => ({ message: 'Campaign restored' }));
  }
}
