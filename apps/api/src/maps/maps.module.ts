import { Module } from '@nestjs/common';
import { CampaignAuditModule } from '../audit/campaign-audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { StorageModule } from '../storage/storage.module';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';

@Module({
  imports: [AuthModule, MembershipModule, CampaignAuditModule, StorageModule],
  controllers: [MapsController],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
