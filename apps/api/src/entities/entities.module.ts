import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { RelationshipsModule } from '../relationships/relationships.module';
import { RevisionRecorderModule } from '../revisions/revision-recorder.module';
import { SessionsModule } from '../sessions/sessions.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { WikiLinksService } from './wiki-links.service';

@Module({
  imports: [
    AuthModule,
    MembershipModule,
    RelationshipsModule,
    SessionsModule,
    RevisionRecorderModule,
    CampaignAuditModule,
  ],
  controllers: [EntitiesController],
  providers: [EntitiesService, WikiLinksService],
  // Newly exported: RevisionsModule (Phase 4) needs EntitiesService for
  // restore — nothing needed it before this milestone.
  exports: [EntitiesService],
})
export class EntitiesModule {}
