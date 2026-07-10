import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { EnvService } from './config/env.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const env = app.get(EnvService);

  app.enableCors({
    origin: env.values.NODE_ENV === 'development',
    credentials: true,
  });

  await app.listen(env.values.PORT);
}

void bootstrap();
