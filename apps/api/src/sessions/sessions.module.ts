import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { PlotThreadsModule } from '../plot-threads/plot-threads.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AuthModule, MembershipModule, PlotThreadsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
