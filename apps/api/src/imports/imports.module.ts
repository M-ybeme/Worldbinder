import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuthModule, StorageModule, JobsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
