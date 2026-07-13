import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { PlotThreadsModule } from '../plot-threads/plot-threads.module';
import { RevisionRecorderModule } from '../revisions/revision-recorder.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    AuthModule,
    MembershipModule,
    PlotThreadsModule,
    RevisionRecorderModule,
    CampaignAuditModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
