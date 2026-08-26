import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CampaignTagSummary } from '@worldbinder/contracts';
import {
  mergeTagSchema,
  renameTagSchema,
  type MergeTagInput,
  type RenameTagInput,
} from '@worldbinder/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CampaignMembershipGuard } from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TagsService } from './tags.service';

// Listing is open to every campaign member (tag names aren't sensitive,
// and TagInput's autocomplete needs them for any editor); rename/merge
// are management-only, same roles that can create/edit tagged resources.
@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ): Promise<CampaignTagSummary[]> {
    return this.tags.listCampaignTags(campaignId);
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Patch(':tagId')
  @HttpCode(HttpStatus.OK)
  rename(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Body(new ZodValidationPipe(renameTagSchema)) body: RenameTagInput,
  ): Promise<{ message: string }> {
    return this.tags
      .renameTag(campaignId, tagId, body.name)
      .then(() => ({ message: 'Tag renamed' }));
  }

  @RequireCampaignRole('owner', 'gm', 'editor')
  @Post(':tagId/merge')
  @HttpCode(HttpStatus.OK)
  merge(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Body(new ZodValidationPipe(mergeTagSchema)) body: MergeTagInput,
  ): Promise<{ message: string }> {
    return this.tags
      .mergeTags(campaignId, tagId, body.targetTagId)
      .then(() => ({ message: 'Tags merged' }));
  }
}
