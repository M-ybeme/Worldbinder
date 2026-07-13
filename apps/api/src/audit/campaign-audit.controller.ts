import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CampaignAuditEvent } from '@worldbinder/contracts';
import { auditQuerySchema, type AuditQuery } from '@worldbinder/validation';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CampaignMembershipGuard } from '../membership/guards/campaign-membership.guard';
import { RequireCampaignRole } from '../membership/guards/campaign-roles.decorator';
import { CampaignRolesGuard } from '../membership/guards/campaign-roles.guard';
import { CampaignAuditService } from './campaign-audit.service';

// Owner/gm-only — the first *read* route in this codebase to use
// @RequireCampaignRole (mirrors campaigns.controller.ts's existing
// archive/delete mutation gating). This route isn't in the roadmap's
// literal route table (which is representative, not exhaustive — it also
// omits the already-shipped GET /relationship-types), but it's the only
// way to back the required "audit activity view" deliverable.
@UseGuards(JwtAuthGuard, CampaignMembershipGuard, CampaignRolesGuard)
@Controller('campaigns/:campaignId/audit')
export class CampaignAuditController {
  constructor(private readonly audit: CampaignAuditService) {}

  @RequireCampaignRole('owner', 'gm')
  @Get()
  list(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<CampaignAuditEvent[]> {
    return this.audit.list(campaignId, query.limit, query.offset);
  }
}
