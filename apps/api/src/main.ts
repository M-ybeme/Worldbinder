// Must be the first import in the entire process — see instrument.ts's own
// doc comment for why (OpenTelemetry module patching has to happen before
// anything else is required).
import './instrument';
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
