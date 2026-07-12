import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ConfigModule } from './config/config.module';
import { EnvService } from './config/env.service';
import { DatabaseModule } from './database/database.module';
import { EntitiesModule } from './entities/entities.module';
import { HealthModule } from './health/health.module';
import { MembershipModule } from './membership/membership.module';
import { PlotThreadsModule } from './plot-threads/plot-threads.module';
import { RedisModule } from './redis/redis.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { SearchModule } from './search/search.module';
import { SessionsModule } from './sessions/sessions.module';

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
  ],
})
export class AppModule implements NestModule {
  // Registered here (not just in main.ts) so it also applies when the Nest
  // testing module builds the app directly via createNestApplication(),
  // bypassing main.ts's bootstrap() entirely.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
