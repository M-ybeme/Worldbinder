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
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  TimelineEventDetail,
  TimelineEventSummary,
} from '@worldbinder/contracts';
import {
  createTimelineEventSchema,
  listTimelineEventsQuerySchema,
  updateTimelineEventSchema,
  type CreateTimelineEventInput,
  type ListTimelineEventsQuery,
  type UpdateTimelineEventInput,
} from '@worldbinder/validation';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { TimelineService } from './timeline.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/timeline')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query(new ZodValidationPipe(listTimelineEventsQuerySchema))
    query: ListTimelineEventsQuery,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<TimelineEventSummary[]> {
    return this.timeline.list(campaignId, membership, query);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createTimelineEventSchema))
    body: CreateTimelineEventInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<TimelineEventDetail> {
    return this.timeline.create(campaignId, membership, body);
  }

  @Get(':eventId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<TimelineEventDetail> {
    return this.timeline.getById(campaignId, eventId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':eventId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body(new ZodValidationPipe(updateTimelineEventSchema))
    body: UpdateTimelineEventInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<TimelineEventDetail> {
    return this.timeline.update(campaignId, eventId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':eventId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.timeline
      .delete(campaignId, eventId, membership)
      .then(() => ({ message: 'Timeline event deleted' }));
  }
}
