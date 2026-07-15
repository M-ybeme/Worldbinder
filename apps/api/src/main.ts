import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { EnvService } from './config/env.service';

// helmet, CORS, and cookie-parser are all registered in AppModule.configure()
// rather than here — see that file's comment. Nest's testing module never
// runs this bootstrap() function, so middleware registered only here would
// silently not apply under the integration test suite.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const env = app.get(EnvService);
  await app.listen(env.values.PORT);
}

void bootstrap();
