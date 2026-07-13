import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { RevisionRecorderModule } from '../revisions/revision-recorder.module';
import { PlotThreadsController } from './plot-threads.controller';
import { PlotThreadsService } from './plot-threads.service';

@Module({
  imports: [
    AuthModule,
    MembershipModule,
    RevisionRecorderModule,
    CampaignAuditModule,
  ],
  controllers: [PlotThreadsController],
  providers: [PlotThreadsService],
  exports: [PlotThreadsService],
})
export class PlotThreadsModule {}
