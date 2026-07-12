import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SearchResponse } from '@worldbinder/contracts';
import { searchQuerySchema, type SearchQuery } from '@worldbinder/validation';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type CampaignMembership,
  CampaignMembershipGuard,
} from '../membership/guards/campaign-membership.guard';
import { CurrentMembership } from '../membership/guards/current-membership.decorator';
import { SearchService } from './search.service';

@UseGuards(JwtAuthGuard, CampaignMembershipGuard)
@Controller('campaigns/:campaignId/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  run(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
    @CurrentMembership() membership: CampaignMembership,
  ): Promise<SearchResponse> {
    return this.search.search(campaignId, membership, query);
  }
}
