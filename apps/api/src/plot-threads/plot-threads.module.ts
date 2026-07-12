import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { PlotThreadsController } from './plot-threads.controller';
import { PlotThreadsService } from './plot-threads.service';

@Module({
  imports: [AuthModule, MembershipModule],
  controllers: [PlotThreadsController],
  providers: [PlotThreadsService],
  exports: [PlotThreadsService],
})
export class PlotThreadsModule {}
