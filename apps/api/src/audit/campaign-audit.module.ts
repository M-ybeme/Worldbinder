import { Module } from '@nestjs/common';
import { CampaignAuditService } from './campaign-audit.service';

// Dependency-free leaf (same shape as RevisionRecorderModule, same
// reason): membership/sessions/revisions/campaigns/entities/plot-threads
// modules all need to call CampaignAuditService.record(), but AuthModule
// (which those modules transitively sit under via MembershipModule)
// already imports the *other* audit.module.ts — putting the campaign-
// scoped audit CONTROLLER in this same module would import MembershipModule
// for its guards, which imports AuthModule, which would import back here:
// a cycle. Keeping this module to the service only, and the controller in
// campaign-audit-view.module.ts, avoids it.
@Module({
  providers: [CampaignAuditService],
  exports: [CampaignAuditService],
})
export class CampaignAuditModule {}
