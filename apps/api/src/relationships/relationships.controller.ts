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
  EntityRelationship,
  RelationshipType,
} from '@worldbinder/contracts';
import {
  createRelationshipSchema,
  createRelationshipTypeSchema,
  updateRelationshipSchema,
  type CreateRelationshipInput,
  type CreateRelationshipTypeInput,
  type UpdateRelationshipInput,
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
import { RelationshipTypesService } from './relationship-types.service';
import { RelationshipsService } from './relationships.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId')
export class RelationshipsController {
  constructor(
    private readonly relationships: RelationshipsService,
    private readonly relationshipTypes: RelationshipTypesService,
  ) {}

  @Get('relationship-types')
  listTypes(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<RelationshipType[]> {
    return this.relationshipTypes.listForCampaign(campaignId);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post('relationship-types')
  @HttpCode(HttpStatus.CREATED)
  createType(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createRelationshipTypeSchema))
    body: CreateRelationshipTypeInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<RelationshipType> {
    return this.relationshipTypes.createCustom(campaignId, membership, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post('relationships')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body(new ZodValidationPipe(createRelationshipSchema))
    body: CreateRelationshipInput,
    @CurrentMembership() membership: CampaignMembership,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<EntityRelationship> {
    return this.relationships.create(campaignId, membership, user.sub, body);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch('relationships/:relationshipId')
  update(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Body(new ZodValidationPipe(updateRelationshipSchema))
    body: UpdateRelationshipInput,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<EntityRelationship> {
    return this.relationships.update(
      campaignId,
      relationshipId,
      membership,
      body,
    );
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Delete('relationships/:relationshipId')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<{ message: string }> {
    return this.relationships
      .delete(campaignId, relationshipId, membership)
      .then(() => ({ message: 'Relationship deleted' }));
  }
}
