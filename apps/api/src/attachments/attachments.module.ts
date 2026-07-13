import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { MembershipModule } from '../membership/membership.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [
    AuthModule,
    MembershipModule,
    StorageModule,
    JobsModule,
    CampaignAuditModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
