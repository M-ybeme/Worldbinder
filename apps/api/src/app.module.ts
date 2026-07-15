import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { LoggerModule } from 'nestjs-pino';
import { CampaignAuditViewModule } from './audit/campaign-audit-view.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ConfigModule } from './config/config.module';
import { EnvService } from './config/env.service';
import { DatabaseModule } from './database/database.module';
import { EntitiesModule } from './entities/entities.module';
import { ExportsModule } from './exports/exports.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { MapsModule } from './maps/maps.module';
import { MembershipModule } from './membership/membership.module';
import { PlotThreadsModule } from './plot-threads/plot-threads.module';
import { RedisModule } from './redis/redis.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { RevisionsModule } from './revisions/revisions.module';
import { SearchModule } from './search/search.module';
import { SessionsModule } from './sessions/sessions.module';
import { TimelineModule } from './timeline/timeline.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        pinoHttp: {
          level: env.values.LOG_LEVEL,
          transport:
            env.values.NODE_ENV === 'development'
              ? { target: 'pino-pretty' }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          customProps: () => ({ environment: env.values.NODE_ENV }),
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    MembershipModule,
    CampaignsModule,
    RelationshipsModule,
    PlotThreadsModule,
    SessionsModule,
    EntitiesModule,
    SearchModule,
    RevisionsModule,
    CampaignAuditViewModule,
    AttachmentsModule,
    MapsModule,
    TimelineModule,
    ExportsModule,
    ImportsModule,
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly env: EnvService) {}

  // Registered here (not just in main.ts) so it also applies when the Nest
  // testing module builds the app directly via createNestApplication(),
  // bypassing main.ts's bootstrap() entirely — same reasoning as
  // cookie-parser (see ADR-0007 / CLAUDE.md's footgun note), extended to
  // helmet and CORS so integration tests actually exercise them instead of
  // silently skipping them.
  configure(consumer: MiddlewareConsumer): void {
    const allowedOrigins = this.env.values.CORS_ORIGIN;
    consumer
      .apply(
        // JSON API with no HTML views of its own — CSP here mainly guards
        // any Express default error page; crossOriginResourcePolicy is
        // relaxed since the frontend is served from a different origin.
        helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }),
        // Environment-driven allow-list (CORS_ORIGIN, comma-separated) —
        // empty in development means "reflect any origin" (matches
        // pre-Milestone-14 behavior); empty anywhere else means no
        // cross-origin requests are allowed at all until a real frontend
        // origin is configured, failing closed rather than silently
        // disabling CORS outright.
        cors({
          origin:
            this.env.values.NODE_ENV === 'development' &&
            allowedOrigins.length === 0
              ? true
              : allowedOrigins,
          credentials: true,
        }),
        cookieParser(),
      )
      .forRoutes('*');
  }
}
