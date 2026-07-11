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
import type { EntityDetail, EntitySummary } from '@worldbinder/contracts';
import {
  createEntitySchema,
  listEntitiesQuerySchema,
  updateEntitySchema,
  type CreateEntityInput,
  type ListEntitiesQuery,
  type UpdateEntityInput,
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
import { EntitiesService } from './entities.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query(new ZodValidationPipe(listEntitiesQuerySchema))
    query: ListEntitiesQuery,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<EntitySummary[]> {
    return this.entities.list(campaignId, membership, query);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createEntitySchema)) body: CreateEntityInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<EntityDetail> {
    return this.entities.create(campaignId, membership, user.sub, body);
  }

  @Get(':entityId')
  getById(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<EntityDetail> {
    return this.entities.getById(campaignId, entityId, membership);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':entityId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Body(new ZodValidationPipe(updateEntitySchema)) body: UpdateEntityInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<EntityDetail> {
    return this.entities.update(
      campaignId,
      entityId,
      membership,
      user.sub,
      body,
    );
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete(':entityId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.entities
      .delete(campaignId, entityId, membership)
      .then(() => ({ message: 'Entity deleted' }));
  }
}
