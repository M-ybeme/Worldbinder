import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { RelationshipTypesService } from './relationship-types.service';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';

@Module({
  imports: [AuthModule, MembershipModule],
  controllers: [RelationshipsController],
  providers: [RelationshipTypesService, RelationshipsService],
  exports: [RelationshipTypesService, RelationshipsService],
})
export class RelationshipsModule {}
