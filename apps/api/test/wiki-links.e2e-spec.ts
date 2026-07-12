import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  Backlink,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
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

const TEST_EMAIL_DOMAIN = 'wiki-links-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

function mentionDoc(entityId: string, label: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'entityMention', attrs: { entityId, label } }],
      },
    ],
  };
}

describe('Wiki links (e2e)', () => {
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
      .send({
        entityType: 'character',
        name: 'Fixture Entity',
        ...overrides,
      });
    return body<EntityDetail>(res);
  }

  it('creates a backlink from a wiki-link mention and surfaces it on the target entity', async () => {
    const { token, campaign } =
      await createOwnerAndCampaign('Backlink Campaign');
    const westvale = await createEntity(token, campaign.id, {
      name: 'Westvale',
      entityType: 'location',
    });
    const duke = await createEntity(token, campaign.id, {
      name: 'Duke Renald',
      publicContentJson: mentionDoc(westvale.id, 'Westvale'),
    });

    const backlinksRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/entities/${westvale.id}/backlinks`)
      .set('Authorization', `Bearer ${token}`);
    expect(backlinksRes.status).toBe(200);
    const backlinks = body<Backlink[]>(backlinksRes);
    const backlink = backlinks.find((b) => b.sourceEntity.id === duke.id);
    expect(backlink?.section).toBe('public');
    expect(backlink?.displayText).toBe('Westvale');
  });

  it('refreshes links on update, dropping ones removed from the content', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Refresh Backlink Campaign',
    );
    const target = await createEntity(token, campaign.id, {
      name: 'Target',
      entityType: 'location',
    });
    const source = await createEntity(token, campaign.id, {
      name: 'Source',
      publicContentJson: mentionDoc(target.id, 'Target'),
    });

    const updateRes = await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.id}/entities/${source.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        entityType: 'character',
        updatedAt: source.updatedAt,
        publicContentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      });
    expect(updateRes.status).toBe(200);

    const backlinksRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/entities/${target.id}/backlinks`)
      .set('Authorization', `Bearer ${token}`);
    expect(body<Backlink[]>(backlinksRes)).toEqual([]);
  });

  it('rejects content that mentions an entity outside the campaign', async () => {
    const { token: tokenA, campaign: campaignA } = await createOwnerAndCampaign(
      'Cross-Campaign Mention A',
    );
    const { token: tokenB, campaign: campaignB } = await createOwnerAndCampaign(
      'Cross-Campaign Mention B',
    );
    const otherCampaignEntity = await createEntity(tokenB, campaignB.id, {
      name: 'Elsewhere',
    });

    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignA.id}/entities`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entityType: 'character',
        name: 'Mentions Outsider',
        publicContentJson: mentionDoc(otherCampaignEntity.id, 'Elsewhere'),
      });
    expect(res.status).toBe(400);
  });

  it('omits a GM-only-section backlink from a player', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'GM Section Backlink Campaign',
    );
    const player = await addMember(campaign.id, 'player-backlink', 'player');
    const target = await createEntity(token, campaign.id, {
      name: 'Secret Target',
      entityType: 'location',
    });
    await createEntity(token, campaign.id, {
      name: 'Secret Source',
      gmContentJson: mentionDoc(target.id, 'Secret Target'),
    });

    const ownerBacklinks = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/entities/${target.id}/backlinks`)
      .set('Authorization', `Bearer ${token}`);
    expect(body<Backlink[]>(ownerBacklinks).length).toBe(1);

    const playerBacklinks = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/entities/${target.id}/backlinks`)
      .set('Authorization', `Bearer ${player.token}`);
    expect(body<Backlink[]>(playerBacklinks)).toEqual([]);
  });
});
