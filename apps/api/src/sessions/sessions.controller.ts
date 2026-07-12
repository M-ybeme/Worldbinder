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
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntitySummary,
} from '@worldbinder/contracts';
import {
  completeSessionSchema,
  createSessionSchema,
  revealEntitySchema,
  updateSessionSchema,
  type CompleteSessionInput,
  type CreateSessionInput,
  type RevealEntityInput,
  type UpdateSessionInput,
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
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignSessionSummary[]> {
    return this.sessions.list(campaignId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignSessionDetail> {
    return this.sessions.create(campaignId, membership, user.sub, body);
  }

  @Get(':sessionId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignSessionDetail> {
    return this.sessions.getById(campaignId, sessionId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':sessionId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: UpdateSessionInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CampaignSessionDetail> {
    return this.sessions.update(
      campaignId,
      sessionId,
      membership,
      user.sub,
      body,
    );
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.sessions
      .delete(campaignId, sessionId, membership)
      .then(() => ({ message: 'Session deleted' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':sessionId/complete')
  complete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(completeSessionSchema))
    body: CompleteSessionInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<CampaignSessionDetail> {
    return this.sessions.complete(campaignId, sessionId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm')
  @Post(':sessionId/reveals')
  @HttpCode(HttpStatus.CREATED)
  reveal(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(revealEntitySchema)) body: RevealEntityInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<EntitySummary> {
    return this.sessions.reveal(
      campaignId,
      sessionId,
      membership,
      body.entityId,
    );
  }
}
