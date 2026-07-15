import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignExportSummary,
  CampaignRole,
} from '@worldbinder/contracts';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import {
  campaignExports,
  campaignMembers,
  users,
} from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'exports-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Exports (e2e)', () => {
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

  async function createOwnerAndCampaign(
    name: string,
  ): Promise<{ token: string; campaign: CampaignDetail }> {
    const password = 'owner-password-123';
    const owner = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, 'owner'),
    );
    const token = await loginAs(owner.email, password);

    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

    return { token, campaign: body<CampaignDetail>(res) };
  }

  async function addMember(
    campaignId: string,
    label: string,
    role: CampaignRole,
  ): Promise<{ token: string }> {
    const password = 'member-password-123';
    const user = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, label),
    );
    await db
      .insert(campaignMembers)
      .values({ campaignId, userId: user.id, role });
    const token = await loginAs(user.email, password);
    return { token };
  }

  /** Simulates the worker finishing an export — the worker's own zip/
   * checksum logic is covered by apps/worker's own unit + real-infra
   * integration tests; this e2e suite verifies the API surface built on
   * top of the resulting `ready` state. */
  async function markReady(exportId: string): Promise<void> {
    await db
      .update(campaignExports)
      .set({
        status: 'ready',
        storageKey: `exports/fixture/${exportId}.zip`,
        sizeBytes: 1234,
      })
      .where(eq(campaignExports.id, exportId));
  }

  describe('create and permissions', () => {
    it('creates an export for the owner and lists/gets it', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Export CRUD Campaign',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${token}`);
      expect(createRes.status).toBe(201);
      const created = body<CampaignExportSummary>(createRes);
      expect(created.status).toBe('pending');
      expect(created.campaignId).toBe(campaign.id);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(
        body<CampaignExportSummary[]>(listRes).some((e) => e.id === created.id),
      ).toBe(true);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/exports/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<CampaignExportSummary>(getRes).id).toBe(created.id);
    });

    it('exposes a download url only once the export is ready', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Export Ready Campaign',
      );
      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${token}`);
      const created = body<CampaignExportSummary>(createRes);
      expect(created.downloadUrl).toBeNull();

      await markReady(created.id);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/exports/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      const ready = body<CampaignExportSummary>(getRes);
      expect(ready.status).toBe('ready');
      expect(ready.downloadUrl).toBeTruthy();
    });

    it('allows a GM to export but rejects an editor and a player', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Export Roles Campaign',
      );
      const gm = await addMember(campaign.id, 'export-gm', 'gm');
      const editor = await addMember(campaign.id, 'export-editor', 'editor');
      const player = await addMember(campaign.id, 'export-player', 'player');

      const gmRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${gm.token}`);
      expect(gmRes.status).toBe(201);

      const editorRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${editor.token}`);
      expect(editorRes.status).toBe(403);

      const playerRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/exports`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerRes.status).toBe(403);
    });

    it('returns 404 for an export fetched through another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Export Isolation A');
      const { campaign: campaignB } =
        await createOwnerAndCampaign('Export Isolation B');

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/exports`)
        .set('Authorization', `Bearer ${tokenA}`);
      const created = body<CampaignExportSummary>(createRes);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/exports/${created.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });
});
