import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  CampaignTagSummary,
  EntityDetail,
  PlotThreadDetail,
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

const TEST_EMAIL_DOMAIN = 'tags-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Tags (e2e)', () => {
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

  describe('listing', () => {
    it('merges usage counts across entities, sessions, timeline events, and plot threads', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Tag List Campaign');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['shared', 'entity-only'],
        });
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Session A', tags: ['shared'] });
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Event A', tags: ['shared'] });
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Thread A', tags: ['shared'] });

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);

      const list = body<CampaignTagSummary[]>(listRes);
      const shared = list.find((t) => t.name === 'shared');
      const entityOnly = list.find((t) => t.name === 'entity-only');
      expect(shared?.usageCount).toBe(4);
      expect(entityOnly?.usageCount).toBe(1);
    });

    it('is readable by a player (not just management roles)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag List Player Read',
      );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['visible-tag'],
        });
      const player = await addMember(campaign.id, 'player', 'player');

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(res.status).toBe(200);
      expect(
        body<CampaignTagSummary[]>(res).some((t) => t.name === 'visible-tag'),
      ).toBe(true);
    });
  });

  describe('rename', () => {
    it('renames a tag and the new name is reflected on tagged resources', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag Rename Campaign',
      );
      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['old-name'],
        });
      const entity = body<EntityDetail>(createRes);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tagId = body<CampaignTagSummary[]>(listRes).find(
        (t) => t.name === 'old-name',
      )?.id;
      expect(tagId).toBeDefined();

      const renameRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/tags/${tagId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'new-name' });
      expect(renameRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<EntityDetail>(getRes).tags).toEqual(['new-name']);
    });

    it('rejects renaming to a name that collides with another existing tag', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag Rename Collision',
      );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['tag-one', 'tag-two'],
        });

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tagOneId = body<CampaignTagSummary[]>(listRes).find(
        (t) => t.name === 'tag-one',
      )?.id;

      const renameRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/tags/${tagOneId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'tag-two' });
      expect(renameRes.status).toBe(409);
    });

    it('rejects a player from renaming a tag', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag Rename Player Rejected',
      );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['some-tag'],
        });
      const player = await addMember(campaign.id, 'player', 'player');

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tagId = body<CampaignTagSummary[]>(listRes).find(
        (t) => t.name === 'some-tag',
      )?.id;

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/tags/${tagId}`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ name: 'renamed' });
      expect(res.status).toBe(403);
    });
  });

  describe('merge', () => {
    it('merges one tag into another across resource types and deletes the source tag', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Tag Merge Campaign');

      const entityRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['source-tag'],
        });
      const entity = body<EntityDetail>(entityRes);

      const threadRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/plot-threads`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Thread A', tags: ['target-tag'] });
      const thread = body<PlotThreadDetail>(threadRes);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tags = body<CampaignTagSummary[]>(listRes);
      const sourceTagId = tags.find((t) => t.name === 'source-tag')?.id;
      const targetTagId = tags.find((t) => t.name === 'target-tag')?.id;

      const mergeRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/tags/${sourceTagId}/merge`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTagId });
      expect(mergeRes.status).toBe(200);

      const entityGetRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<EntityDetail>(entityGetRes).tags).toEqual(['target-tag']);

      const threadGetRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${thread.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<PlotThreadDetail>(threadGetRes).tags).toEqual(['target-tag']);

      const afterMergeListRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const afterMergeTags = body<CampaignTagSummary[]>(afterMergeListRes);
      expect(afterMergeTags.some((t) => t.name === 'source-tag')).toBe(false);
      expect(
        afterMergeTags.find((t) => t.name === 'target-tag')?.usageCount,
      ).toBe(2);
    });

    it('drops the duplicate link rather than erroring when a resource already carries both tags', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag Merge Duplicate Link',
      );
      const entityRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['dup-source', 'dup-target'],
        });
      const entity = body<EntityDetail>(entityRes);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tags = body<CampaignTagSummary[]>(listRes);
      const sourceTagId = tags.find((t) => t.name === 'dup-source')?.id;
      const targetTagId = tags.find((t) => t.name === 'dup-target')?.id;

      const mergeRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/tags/${sourceTagId}/merge`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTagId });
      expect(mergeRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<EntityDetail>(getRes).tags).toEqual(['dup-target']);
    });

    it('rejects a player from merging tags', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Tag Merge Player Rejected',
      );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/entities`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          entityType: 'character',
          name: 'Entity A',
          tags: ['a-tag', 'b-tag'],
        });
      const player = await addMember(campaign.id, 'player', 'player');

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/tags`)
        .set('Authorization', `Bearer ${token}`);
      const tags = body<CampaignTagSummary[]>(listRes);
      const sourceTagId = tags.find((t) => t.name === 'a-tag')?.id;
      const targetTagId = tags.find((t) => t.name === 'b-tag')?.id;

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/tags/${sourceTagId}/merge`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ targetTagId });
      expect(res.status).toBe(403);
    });
  });
});
