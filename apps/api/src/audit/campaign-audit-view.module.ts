import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { CampaignAuditController } from './campaign-audit.controller';
import { CampaignAuditModule } from './campaign-audit.module';

// Imports the leaf CampaignAuditModule (for the service), MembershipModule
// (for the owner/gm role guards), and AuthModule (JwtAuthGuard's own
// dependency, TokenService — module imports aren't transitive, so this is
// needed even though MembershipModule already imports AuthModule itself,
// same as every other controller module in this codebase). One direction
// only — none of these import this module back.
@Module({
  imports: [AuthModule, MembershipModule, CampaignAuditModule],
  controllers: [CampaignAuditController],
})
export class CampaignAuditViewModule {}
