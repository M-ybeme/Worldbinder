import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

@Module({
  imports: [AuthModule, MembershipModule, CampaignAuditModule],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
