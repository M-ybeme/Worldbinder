import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { MembershipModule } from '../membership/membership.module';
import { StorageModule } from '../storage/storage.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AuthModule, MembershipModule, StorageModule, JobsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
