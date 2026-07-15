import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EnvService } from '../src/config/env.service';

const realEnv = new EnvService();

function envServiceWith(overrides: Partial<EnvService['values']>): EnvService {
  return { values: { ...realEnv.values, ...overrides } };
}

async function buildApp(env: EnvService): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EnvService)
    .useValue(env)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

describe('Security headers (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await buildApp(envServiceWith({}));
  });

  afterEach(async () => {
    await app.close();
  });

  it('helmet adds standard security headers', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('relaxes cross-origin-resource-policy so the frontend (a different origin) can fetch it', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('CORS allow-list (e2e)', () => {
  it('reflects any origin in development when CORS_ORIGIN is unset', async () => {
    const app = await buildApp(
      envServiceWith({ NODE_ENV: 'development', CORS_ORIGIN: [] }),
    );
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://anything.example.com');
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://anything.example.com',
    );
    await app.close();
  });

  it('fails closed outside development when CORS_ORIGIN is unset', async () => {
    const app = await buildApp(
      envServiceWith({ NODE_ENV: 'production', CORS_ORIGIN: [] }),
    );
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://anything.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('allows only the configured origins outside development', async () => {
    const app = await buildApp(
      envServiceWith({
        NODE_ENV: 'production',
        CORS_ORIGIN: ['https://app.example.com'],
      }),
    );

    const allowed = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.com',
    );

    const rejected = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://not-allowed.example.com');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });
});
