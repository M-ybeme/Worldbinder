import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { StorageModule } from '../storage/storage.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [AuthModule, MembershipModule, CampaignAuditModule, StorageModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
