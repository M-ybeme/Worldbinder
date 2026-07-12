import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { RelationshipsModule } from '../relationships/relationships.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { WikiLinksService } from './wiki-links.service';

@Module({
  imports: [AuthModule, MembershipModule, RelationshipsModule],
  controllers: [EntitiesController],
  providers: [EntitiesService, WikiLinksService],
})
export class EntitiesModule {}
