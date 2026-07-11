import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  EntityDetail,
  EntitySummary,
} from '@worldbinder/contracts';
import type { CampaignRole } from '@worldbinder/contracts';
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

const TEST_EMAIL_DOMAIN = 'entities-integration-test.local';

const TIPTAP_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Entities (e2e)', () => {
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
    editorSecretAccess = false,
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
      .values({ campaignId, userId: user.id, role, editorSecretAccess });
    const token = await loginAs(user.email, password);
    return { token };
  }

  function createEntityPayload(overrides: Record<string, unknown> = {}) {
    return {
      entityType: 'character',
      name: 'Duke Renald',
      summary: 'A minor noble.',
      tags: ['nobility', 'antagonist'],
      publicContentJson: TIPTAP_DOC,
      metadata: { species: 'Human', lifeStatus: 'alive' },
      ...overrides,
    };
  }

  describe('create and get', () => {
    it('creates an entity and returns it with all fields for the owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Entity CRUD Campaign',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEntityPayload());
      expect(createRes.status).toBe(201);

      const created = body<EntityDetail>(createRes);
      expect(created.name).toBe('Duke Renald');
      expect(created.entityType).toBe('character');
      expect(created.slug).toEqual(expect.any(String));
      expect(created.tags.sort()).toEqual(['antagonist', 'nobility']);
      expect(created.metadataJson).toMatchObject({ species: 'Human' });

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<EntityDetail>(getRes).id).toBe(created.id);
    });

    it('rejects a player from creating an entity', async () => {
      const { campaign } = await createOwnerAndCampaign('Player Cannot Create');
      const player = await addMember(campaign.id, 'player', 'player');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${player.token}`)
        .send(createEntityPayload());
      expect(res.status).toBe(403);
    });
  });

  describe('tags', () => {
    it('reuses an existing tag rather than creating a duplicate', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Tag Reuse Campaign');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(
          createEntityPayload({ name: 'Entity One', tags: ['shared-tag'] }),
        );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(
          createEntityPayload({ name: 'Entity Two', tags: ['Shared-Tag'] }),
        );

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities`)
        .query({ tag: 'shared-tag' })
        .set('Authorization', `Bearer ${token}`);

      const list = body<EntitySummary[]>(listRes);
      expect(list.length).toBe(2);
    });
  });

  describe('field-level filtering (§13.2)', () => {
    it('omits gmContentJson entirely for a player, includes it for the owner', async () => {
      const { token: ownerToken, campaign } = await createOwnerAndCampaign(
        'GM Content Campaign',
      );
      const player = await addMember(
        campaign.id,
        'player-gm-content',
        'player',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(
          createEntityPayload({
            name: 'Secret-Bearing Entity',
            gmContentJson: TIPTAP_DOC,
          }),
        );
      const entityId = body<EntityDetail>(createRes).id;

      const ownerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(body<EntityDetail>(ownerView).gmContentJson).toBeDefined();

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerView.status).toBe(200);
      expect(playerView.body).not.toHaveProperty('gmContentJson');
    });

    it('hides a gm_only-visibility entity from a player entirely (404, not 403)', async () => {
      const { token: ownerToken, campaign } = await createOwnerAndCampaign(
        'GM Only Visibility Campaign',
      );
      const player = await addMember(
        campaign.id,
        'player-visibility',
        'player',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(
          createEntityPayload({ name: 'Hidden NPC', visibility: 'gm_only' }),
        );
      const entityId = body<EntityDetail>(createRes).id;

      const playerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerGet.status).toBe(404);

      const playerList = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(
        body<EntitySummary[]>(playerList).some((e) => e.id === entityId),
      ).toBe(false);

      const ownerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerGet.status).toBe(200);
    });

    it('lets an editor with secret access see GM content, but not one without', async () => {
      const { token: ownerToken, campaign } = await createOwnerAndCampaign(
        'Editor Secret Access Campaign',
      );
      const trustedEditor = await addMember(
        campaign.id,
        'trusted-editor',
        'editor',
        true,
      );
      const regularEditor = await addMember(
        campaign.id,
        'regular-editor',
        'editor',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(
          createEntityPayload({
            name: 'Split Secret',
            gmContentJson: TIPTAP_DOC,
          }),
        );
      const entityId = body<EntityDetail>(createRes).id;

      const trustedView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${trustedEditor.token}`);
      expect(body<EntityDetail>(trustedView).gmContentJson).toBeDefined();

      const regularView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${regularEditor.token}`);
      expect(regularView.body).not.toHaveProperty('gmContentJson');

      const regularWrite = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${regularEditor.token}`)
        .send({
          entityType: 'character',
          updatedAt: body<EntityDetail>(createRes).updatedAt,
          gmContentJson: TIPTAP_DOC,
        });
      expect(regularWrite.status).toBe(403);
    });
  });

  describe('update', () => {
    it('updates fields and rejects a mismatched entityType', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Update Campaign');
      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEntityPayload());
      const created = body<EntityDetail>(createRes);

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          updatedAt: created.updatedAt,
          summary: 'Updated summary.',
        });
      expect(updateRes.status).toBe(200);
      expect(body<EntityDetail>(updateRes).summary).toBe('Updated summary.');

      const wrongTypeRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'location',
          updatedAt: body<EntityDetail>(updateRes).updatedAt,
          summary: 'Nope',
        });
      expect(wrongTypeRes.status).toBe(403);
    });

    it('returns 409 with the current version on a stale update', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Conflict Campaign');
      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEntityPayload());
      const created = body<EntityDetail>(createRes);

      const staleRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          updatedAt: new Date(
            Date.parse(created.updatedAt) - 1000,
          ).toISOString(),
          summary: 'Conflicting write',
        });
      expect(staleRes.status).toBe(409);
      expect(body<{ code: string }>(staleRes).code).toBe('STALE_UPDATE');
    });
  });

  describe('soft delete', () => {
    it('deletes an entity and excludes it from get/list afterward', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Delete Campaign');
      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEntityPayload());
      const created = body<EntityDetail>(createRes);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`);
      expect(
        body<EntitySummary[]>(listRes).some((e) => e.id === created.id),
      ).toBe(false);
    });
  });

  describe('cross-campaign isolation', () => {
    it('returns 404 for an entity fetched through another campaign', async () => {
      const { token: ownerAToken, campaign: campaignA } =
        await createOwnerAndCampaign('Isolation Campaign A');
      const { campaign: campaignB } = await createOwnerAndCampaign(
        'Isolation Campaign B',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/entities`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send(createEntityPayload());
      const entityId = body<EntityDetail>(createRes).id;

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/entities/${entityId}`)
        .set('Authorization', `Bearer ${ownerAToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('list filters', () => {
    it('filters by entity type and by name search', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Filter Campaign');
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(
          createEntityPayload({
            name: 'Ashgrove Village',
            entityType: 'location',
            tags: [],
          }),
        );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send(
          createEntityPayload({
            name: 'Captain Ashgrove',
            entityType: 'character',
            tags: [],
          }),
        );

      const byType = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities`)
        .query({ entityType: 'location' })
        .set('Authorization', `Bearer ${token}`);
      const typeResults = body<EntitySummary[]>(byType);
      expect(typeResults.every((e) => e.entityType === 'location')).toBe(true);
      expect(typeResults.some((e) => e.name === 'Ashgrove Village')).toBe(true);

      const bySearch = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities`)
        .query({ search: 'ashgrove' })
        .set('Authorization', `Bearer ${token}`);
      const searchResults = body<EntitySummary[]>(bySearch);
      expect(searchResults.length).toBe(2);
    });
  });
});
