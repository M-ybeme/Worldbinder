import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { MailModule } from '../mail/mail.module';
import { CampaignPolicyService } from './campaign-policy.service';
import { CampaignMembershipGuard } from './guards/campaign-membership.guard';
import { CampaignRolesGuard } from './guards/campaign-roles.guard';
import { InvitationAcceptController } from './invitation-accept.controller';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({
  imports: [AuthModule, CommonModule, MailModule, CampaignAuditModule],
  controllers: [MembershipController, InvitationAcceptController],
  providers: [
    MembershipService,
    CampaignPolicyService,
    CampaignMembershipGuard,
    CampaignRolesGuard,
  ],
  exports: [CampaignPolicyService, CampaignMembershipGuard, CampaignRolesGuard],
})
export class MembershipModule {}
