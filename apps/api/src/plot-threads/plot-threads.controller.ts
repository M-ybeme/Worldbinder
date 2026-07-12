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
import type {
  PlotThreadDetail,
  PlotThreadSummary,
} from '@worldbinder/contracts';
import {
  createPlotThreadSchema,
  updatePlotThreadSchema,
  type CreatePlotThreadInput,
  type UpdatePlotThreadInput,
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
import { PlotThreadsService } from './plot-threads.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/plot-threads')
export class PlotThreadsController {
  constructor(private readonly plotThreads: PlotThreadsService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<PlotThreadSummary[]> {
    return this.plotThreads.list(campaignId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createPlotThreadSchema))
    body: CreatePlotThreadInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PlotThreadDetail> {
    return this.plotThreads.create(campaignId, membership, user.sub, body);
  }

  @Get(':threadId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<PlotThreadDetail> {
    return this.plotThreads.getById(campaignId, threadId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':threadId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body(new ZodValidationPipe(updatePlotThreadSchema))
    body: UpdatePlotThreadInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PlotThreadDetail> {
    return this.plotThreads.update(
      campaignId,
      threadId,
      membership,
      user.sub,
      body,
    );
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':threadId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.plotThreads
      .delete(campaignId, threadId, membership)
      .then(() => ({ message: 'Plot thread deleted' }));
  }
}
