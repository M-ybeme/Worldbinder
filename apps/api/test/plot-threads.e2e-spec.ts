import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  PlotThreadDetail,
  PlotThreadSummary,
} from '@worldbinder/contracts';
import { like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { campaignMembers, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'plot-threads-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Plot threads (e2e)', () => {
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

  async function createEntity(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<EntityDetail> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/entities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'character', name: 'Fixture Entity', ...overrides });
    return body<EntityDetail>(res);
  }

  async function createThread(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<PlotThreadDetail> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/plot-threads`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fixture Thread', ...overrides });
    return body<PlotThreadDetail>(res);
  }

  describe('create, get, update, delete', () => {
    it('creates a thread with default status/importance/visibility', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread CRUD Campaign',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'The Missing Caravan', summary: 'A caravan vanished.' });
      expect(createRes.status).toBe(201);

      const created = body<PlotThreadDetail>(createRes);
      expect(created.title).toBe('The Missing Caravan');
      expect(created.status).toBe('foreshadowed');
      expect(created.importance).toBe('standard');
      expect(created.playerFacingStatus).toBe('open');

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<PlotThreadDetail>(getRes).id).toBe(created.id);
    });

    it('updates a thread and rejects a stale update', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Update Campaign',
      );
      const created = await createThread(token, campaign.id);

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, title: 'Renamed Thread' });
      expect(updateRes.status).toBe(200);
      expect(body<PlotThreadDetail>(updateRes).title).toBe('Renamed Thread');

      const staleRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, title: 'Conflicting Title' });
      expect(staleRes.status).toBe(409);
      expect(body<{ code: string }>(staleRes).code).toBe('STALE_UPDATE');
    });

    it('deletes a thread and excludes it from get/list afterward', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Delete Campaign',
      );
      const created = await createThread(token, campaign.id);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('rejects a player from creating a plot thread', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Player Cannot Create Thread',
      );
      const player = await addMember(campaign.id, 'player', 'player');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ title: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for a thread fetched through another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Thread Isolation A');
      const { campaign: campaignB } =
        await createOwnerAndCampaign('Thread Isolation B');
      const created = await createThread(tokenA, campaignA.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('related entities', () => {
    it('full-replace syncs related entities and rejects a cross-campaign entity id', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Entities Campaign',
      );
      const npc = await createEntity(token, campaign.id, { name: 'Cedric' });
      const created = await createThread(token, campaign.id, {
        entityIds: [npc.id],
      });
      expect(created.entities.map((e) => e.id)).toEqual([npc.id]);

      const clearRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, entityIds: [] });
      expect(clearRes.status).toBe(200);
      expect(body<PlotThreadDetail>(clearRes).entities).toEqual([]);

      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Thread Entities Campaign B');
      const outsider = await createEntity(tokenB, campaignB.id);

      const rejectRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nope', entityIds: [outsider.id] });
      expect(rejectRes.status).toBe(400);
    });
  });

  describe('visibility and field omission', () => {
    it('hides a gm_only thread from a player (404, not 403)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'GM Only Thread Campaign',
      );
      const player = await addMember(
        campaign.id,
        'hidden-thread-player',
        'player',
      );
      const created = await createThread(token, campaign.id, {
        visibility: 'gm_only',
      });

      const playerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerGet.status).toBe(404);

      const playerList = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(
        body<PlotThreadSummary[]>(playerList).some((t) => t.id === created.id),
      ).toBe(false);
    });

    it('omits status/importance/gmContentJson for a player but includes them for the owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread GM Fields Campaign',
      );
      const player = await addMember(
        campaign.id,
        'thread-fields-player',
        'player',
      );
      const created = await createThread(token, campaign.id, {
        gmContentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
        importance: 'critical',
      });

      const ownerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<PlotThreadDetail>(ownerView).status).toBe('foreshadowed');
      expect(body<PlotThreadDetail>(ownerView).importance).toBe('critical');
      expect(body<PlotThreadDetail>(ownerView).gmContentJson).toBeDefined();

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerView.body).not.toHaveProperty('status');
      expect(playerView.body).not.toHaveProperty('importance');
      expect(playerView.body).not.toHaveProperty('gmContentJson');
      expect(body<PlotThreadDetail>(playerView).playerFacingStatus).toBe(
        'open',
      );
    });

    it.each([
      ['foreshadowed', 'open'],
      ['active', 'ongoing'],
      ['dormant', 'ongoing'],
      ['resolved', 'completed'],
      ['abandoned', 'open'],
    ] as const)(
      'projects internal status %s to player-facing status %s',
      async (status, playerFacingStatus) => {
        const { token, campaign } = await createOwnerAndCampaign(
          `Status Projection ${status} Campaign`,
        );
        const created = await createThread(token, campaign.id);

        const updateRes = await request(app.getHttpServer())
          .patch(`/campaigns/${campaign.id}/plot-threads/${created.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ updatedAt: created.updatedAt, status });
        expect(body<PlotThreadDetail>(updateRes).playerFacingStatus).toBe(
          playerFacingStatus,
        );
      },
    );
  });
});
