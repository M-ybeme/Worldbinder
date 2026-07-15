import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GlobalRateLimitGuard } from './global-rate-limit.guard';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  providers: [
    RateLimiterService,
    { provide: APP_GUARD, useClass: GlobalRateLimitGuard },
  ],
  exports: [RateLimiterService],
})
export class CommonModule {}
