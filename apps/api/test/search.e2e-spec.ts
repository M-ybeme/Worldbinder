import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  EntityDetail,
  PlotThreadDetail,
  RelationshipType,
  SearchResponse,
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

const TEST_EMAIL_DOMAIN = 'search-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Search (e2e)', () => {
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

  async function createSession(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<CampaignSessionDetail> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fixture Session', ...overrides });
    return body<CampaignSessionDetail>(res);
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

  async function requireBuiltInType(
    token: string,
    campaignId: string,
    key: string,
  ): Promise<RelationshipType> {
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/relationship-types`)
      .set('Authorization', `Bearer ${token}`);
    const type = body<RelationshipType[]>(res).find((t) => t.key === key);
    if (!type) throw new Error(`Built-in relationship type "${key}" missing`);
    return type;
  }

  async function search(
    token: string,
    campaignId: string,
    params: string,
  ): Promise<SearchResponse> {
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/search?${params}`)
      .set('Authorization', `Bearer ${token}`);
    return body<SearchResponse>(res);
  }

  describe('ranking', () => {
    it('ranks exact name above prefix above fuzzy above content matches', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Ranking Campaign');
      await createEntity(token, campaign.id, { name: 'Ashen' });
      await createEntity(token, campaign.id, { name: 'Ashen Guard' });
      await createEntity(token, campaign.id, {
        name: 'Unrelated Sentinel',
        publicContentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Loyal to the Ashen cause.' }],
            },
          ],
        },
      });

      const result = await search(token, campaign.id, 'q=Ashen');
      const titles = result.results.map((r) => r.title);

      expect(titles.indexOf('Ashen')).toBeLessThan(
        titles.indexOf('Ashen Guard'),
      );
      expect(titles.indexOf('Ashen Guard')).toBeLessThan(
        titles.indexOf('Unrelated Sentinel'),
      );
    });

    it('matches an alias at the exact-alias tier', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Alias Campaign');
      const entity = await createEntity(token, campaign.id, {
        name: 'Duke Renald',
        aliases: ['The Iron Duke'],
      });

      const result = await search(token, campaign.id, 'q=The Iron Duke');
      expect(result.results[0]?.id).toBe(entity.id);
      expect(result.results[0]?.tier).toBe(2);
    });
  });

  describe('resource coverage', () => {
    it('finds sessions, plot threads, and relationships alongside entities', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Coverage Campaign');
      const duke = await createEntity(token, campaign.id, {
        name: 'Duke Renald',
      });
      const westvale = await createEntity(token, campaign.id, {
        name: 'Westvale',
        entityType: 'location',
      });
      await createSession(token, campaign.id, { title: 'The Renald Gambit' });
      await createThread(token, campaign.id, {
        title: 'The Renald Conspiracy',
      });
      const controls = await requireBuiltInType(token, campaign.id, 'controls');
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: duke.id,
          targetEntityId: westvale.id,
          relationshipTypeId: controls.id,
          description: 'Renald rules Westvale with an iron fist.',
        });

      const result = await search(token, campaign.id, 'q=Renald');
      const byType = new Set(result.results.map((r) => r.resourceType));

      expect(byType).toEqual(
        new Set(['entity', 'session', 'plot_thread', 'relationship']),
      );
      const relationshipResult = result.results.find(
        (r) => r.resourceType === 'relationship',
      );
      expect(relationshipResult?.linkEntityId).toBe(duke.id);
    });

    it('filters results by resource type', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Filter Campaign');
      await createEntity(token, campaign.id, { name: 'Filtered Match' });
      await createSession(token, campaign.id, { title: 'Filtered Match' });

      const result = await search(
        token,
        campaign.id,
        'q=Filtered Match&types=session',
      );
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.resourceType).toBe('session');
    });
  });

  describe('visibility', () => {
    it('does not return entities from a different campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Isolation Campaign A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Isolation Campaign B');
      await createEntity(tokenA, campaignA.id, {
        name: 'Cross Campaign Target',
      });

      const result = await search(
        tokenB,
        campaignB.id,
        'q=Cross Campaign Target',
      );
      expect(result.results).toHaveLength(0);
    });

    it('excludes a gm_only entity entirely for a player, even on an exact name match', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Hidden Entity Campaign',
      );
      const { token: playerToken } = await addMember(
        campaign.id,
        'player',
        'player',
      );
      await createEntity(token, campaign.id, {
        name: 'Hidden Villain',
        visibility: 'gm_only',
      });

      const gmResult = await search(token, campaign.id, 'q=Hidden Villain');
      expect(gmResult.results).toHaveLength(1);

      const playerResult = await search(
        playerToken,
        campaign.id,
        'q=Hidden Villain',
      );
      expect(playerResult.results).toHaveLength(0);
    });

    it('never matches a player query against gm-only content, even when the parent entity is public', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Secret Content Campaign',
      );
      const { token: playerToken } = await addMember(
        campaign.id,
        'player',
        'player',
      );
      await createEntity(token, campaign.id, {
        name: 'Ashen Guard',
        publicContentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Patrols the northern wall.' }],
            },
          ],
        },
        gmContentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Secretly loyal to the assassin.' },
              ],
            },
          ],
        },
      });

      const gmResult = await search(token, campaign.id, 'q=assassin');
      expect(gmResult.results).toHaveLength(1);

      const playerResult = await search(playerToken, campaign.id, 'q=assassin');
      expect(playerResult.results).toHaveLength(0);

      // The entity itself is still findable by a player via its public content —
      // proves the vector split gates content, not the whole entity.
      const publicMatch = await search(
        playerToken,
        campaign.id,
        'q=northern wall',
      );
      expect(publicMatch.results).toHaveLength(1);
    });

    it('excludes a relationship when either endpoint entity is hidden, even though the relationship itself is public', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Hidden Endpoint Campaign',
      );
      const { token: playerToken } = await addMember(
        campaign.id,
        'player',
        'player',
      );
      const visible = await createEntity(token, campaign.id, {
        name: 'Visible Entity',
      });
      const hidden = await createEntity(token, campaign.id, {
        name: 'Hidden Entity',
        entityType: 'location',
        visibility: 'gm_only',
      });
      const controls = await requireBuiltInType(token, campaign.id, 'controls');
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: visible.id,
          targetEntityId: hidden.id,
          relationshipTypeId: controls.id,
          description: 'A uniquely searchable relationship description string.',
        });

      const gmResult = await search(
        token,
        campaign.id,
        'q=uniquely searchable relationship&types=relationship',
      );
      expect(gmResult.results).toHaveLength(1);

      const playerResult = await search(
        playerToken,
        campaign.id,
        'q=uniquely searchable relationship&types=relationship',
      );
      expect(playerResult.results).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    it('respects limit and offset', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Pagination Campaign',
      );
      await createEntity(token, campaign.id, { name: 'Pagination Item One' });
      await createEntity(token, campaign.id, { name: 'Pagination Item Two' });
      await createEntity(token, campaign.id, { name: 'Pagination Item Three' });

      const firstPage = await search(
        token,
        campaign.id,
        'q=Pagination Item&limit=2&offset=0',
      );
      const secondPage = await search(
        token,
        campaign.id,
        'q=Pagination Item&limit=2&offset=2',
      );

      expect(firstPage.results).toHaveLength(2);
      expect(secondPage.results).toHaveLength(1);
      expect(firstPage.total).toBe(3);
      expect(secondPage.total).toBe(3);
    });
  });
});
