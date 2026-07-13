import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { EntitiesModule } from '../entities/entities.module';
import { MembershipModule } from '../membership/membership.module';
import { PlotThreadsModule } from '../plot-threads/plot-threads.module';
import { SessionsModule } from '../sessions/sessions.module';
import { RevisionsController } from './revisions.controller';
import { RevisionsService } from './revisions.service';

// Imports the three owning modules (one direction only) so restore() can
// call their real update() methods — see revisions.service.ts's doc
// comment. Those modules only ever import RevisionRecorderModule, never
// this one, so there's no cycle.
@Module({
  imports: [
    AuthModule,
    MembershipModule,
    EntitiesModule,
    SessionsModule,
    PlotThreadsModule,
    CampaignAuditModule,
  ],
  controllers: [RevisionsController],
  providers: [RevisionsService],
})
export class RevisionsModule {}
