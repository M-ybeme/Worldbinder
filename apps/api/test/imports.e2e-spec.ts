import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignImportSummary,
  PresignedImportUploadResponse,
} from '@worldbinder/contracts';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { campaignImports, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'imports-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Imports (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let passwords: PasswordService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DRIZZLE);
    passwords = moduleFixture.get(PasswordService);

    const redis: Redis = moduleFixture.get(REDIS);
    const rateLimitKeys = await redis.keys('ratelimit:*');
    if (rateLimitKeys.length > 0) await redis.del(...rateLimitKeys);
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `%@${TEST_EMAIL_DOMAIN}`));
    await app.close();
  }, 15000);

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return body<AuthTokenResponse>(res).accessToken;
  }

  async function createUser(label: string): Promise<{ token: string }> {
    const password = 'importer-password-123';
    const user = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, label),
    );
    const token = await loginAs(user.email, password);
    return { token };
  }

  /** Real presign -> real PUT straight to MinIO -> real complete() —
   * exercises the actual storage integration, not a mock. */
  async function uploadAndComplete(
    token: string,
    bytes: Buffer = Buffer.from('fixture archive bytes'),
  ): Promise<string> {
    const presignRes = await request(app.getHttpServer())
      .post('/imports/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'fixture.zip', sizeBytes: bytes.byteLength });
    expect(presignRes.status).toBe(201);
    const { importId, uploadUrl } =
      body<PresignedImportUploadResponse>(presignRes);

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(bytes),
    });
    expect(putRes.ok).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/imports/${importId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(completeRes.status).toBe(201);
    expect(body<CampaignImportSummary>(completeRes).status).toBe('validating');

    return importId;
  }

  /** Simulates the worker finishing validation — the worker's own archive
   * parsing/checksum/security logic is covered by apps/worker's unit +
   * real-infra integration tests; this e2e suite verifies the API surface
   * built on top of the resulting `dry_run_ready` state. */
  async function markDryRunReady(importId: string): Promise<void> {
    await db
      .update(campaignImports)
      .set({
        status: 'dry_run_ready',
        dryRunReportJson: { counts: { entities: 1 }, warnings: [] },
      })
      .where(eq(campaignImports.id, importId));
  }

  it('presigns, completes, and polls an import through to dry_run_ready', async () => {
    const { token } = await createUser('lifecycle');
    const importId = await uploadAndComplete(token);

    const pollRes = await request(app.getHttpServer())
      .get(`/imports/${importId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(body<CampaignImportSummary>(pollRes).status).toBe('validating');

    await markDryRunReady(importId);

    const readyRes = await request(app.getHttpServer())
      .get(`/imports/${importId}`)
      .set('Authorization', `Bearer ${token}`);
    const ready = body<CampaignImportSummary>(readyRes);
    expect(ready.status).toBe('dry_run_ready');
    expect(ready.dryRunReport?.counts.entities).toBe(1);
  });

  it('confirms a dry_run_ready import, moving it to importing', async () => {
    const { token } = await createUser('confirm');
    const importId = await uploadAndComplete(token);
    await markDryRunReady(importId);

    const confirmRes = await request(app.getHttpServer())
      .post(`/imports/${importId}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmRes.status).toBe(200);
    expect(body<CampaignImportSummary>(confirmRes).status).toBe('importing');
  });

  it('rejects confirming an import that is not yet dry_run_ready', async () => {
    const { token } = await createUser('early-confirm');
    const importId = await uploadAndComplete(token);

    const confirmRes = await request(app.getHttpServer())
      .post(`/imports/${importId}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmRes.status).toBe(409);
  });

  it('rejects completing the same import twice', async () => {
    const { token } = await createUser('double-complete');
    const importId = await uploadAndComplete(token);

    const secondCompleteRes = await request(app.getHttpServer())
      .post(`/imports/${importId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondCompleteRes.status).toBe(409);
  });

  it('scopes imports to their owning user — another user gets 404', async () => {
    const { token: ownerToken } = await createUser('owner-scope');
    const { token: strangerToken } = await createUser('stranger-scope');
    const importId = await uploadAndComplete(ownerToken);

    const res = await request(app.getHttpServer())
      .get(`/imports/${importId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(404);
  });

  it('requires authentication to presign an import', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/presign')
      .send({ filename: 'fixture.zip', sizeBytes: 100 });
    expect(res.status).toBe(401);
  });
});
