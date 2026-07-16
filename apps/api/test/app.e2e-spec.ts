import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { HealthCheckResponse } from '@worldbinder/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) reports database, redis, storage, and queue as up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthCheckResponse;
        expect(body.status).toBe('ok');
        expect(body.info?.database.status).toBe('up');
        expect(body.info?.redis.status).toBe('up');
        expect(body.info?.storage.status).toBe('up');
        expect(body.info?.queue.status).toBe('up');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
