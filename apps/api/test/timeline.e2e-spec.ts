import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  CampaignSessionSummary,
  EntityDetail,
  SearchResponse,
  TimelineEventDetail,
  TimelineEventSummary,
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

const TEST_EMAIL_DOMAIN = 'timeline-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Timeline (e2e)', () => {
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
  ): Promise<CampaignSessionSummary> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fixture Session', ...overrides });
    return body<CampaignSessionSummary>(res);
  }

  async function createEvent(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<TimelineEventDetail> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/timeline`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fixture Event', ...overrides });
    return body<TimelineEventDetail>(res);
  }

  const CUSTOM_CALENDAR = {
    schemaVersion: 1,
    months: [
      { name: 'Frostwane', days: 40 },
      { name: 'Sunreach', days: 35 },
      { name: 'Harvestide', days: 30 },
    ],
  };

  describe('event CRUD', () => {
    it('creates, gets, updates, and deletes a timeline event', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline CRUD Campaign',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'The Founding of Blackwall',
          summary: 'A settlement is founded.',
          startDateJson: { year: 100, month: 3, day: 15 },
          datePrecision: 'day',
        });
      expect(createRes.status).toBe(201);
      const created = body<TimelineEventDetail>(createRes);
      expect(created.title).toBe('The Founding of Blackwall');
      expect(created.datePrecision).toBe('day');
      expect(created.visibility).toBe('public');

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<TimelineEventDetail>(getRes).entities).toEqual([]);

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/timeline/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'The Founding of Blackwall (Revised)' });
      expect(updateRes.status).toBe(200);
      expect(body<TimelineEventDetail>(updateRes).title).toBe(
        'The Founding of Blackwall (Revised)',
      );

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/timeline/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const afterDelete = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(afterDelete.status).toBe(404);

      const auditRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/audit`)
        .set('Authorization', `Bearer ${token}`);
      const events =
        body<{ type: string; targetResourceType: string | null }[]>(auditRes);
      expect(
        events.some(
          (e) =>
            e.type === 'destructive_action' &&
            e.targetResourceType === 'timeline_event',
        ),
      ).toBe(true);
    });

    it('creates an undated event with no date fields', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Undated Campaign',
      );
      const created = await createEvent(token, campaign.id, {
        title: 'Unknown Prophecy',
      });
      expect(created.startDateJson).toBeNull();
      expect(created.datePrecision).toBeNull();
    });

    it('rejects a player from creating a timeline event', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Timeline Player Create Campaign',
      );
      const player = await addMember(campaign.id, 'create-player', 'player');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ title: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for an event fetched through another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Timeline Isolation A');
      const { campaign: campaignB } = await createOwnerAndCampaign(
        'Timeline Isolation B',
      );
      const created = await createEvent(tokenA, campaignA.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/timeline/${created.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('date validation', () => {
    it('rejects a date/precision that is out of range for the default calendar', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Date Bounds Campaign',
      );

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Impossible Date',
          startDateJson: { year: 1, month: 2, day: 30 },
          datePrecision: 'day',
        });
      expect(res.status).toBe(400);
    });

    it('validates dates against a campaign-specific custom calendar', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Custom Calendar Campaign',
      );
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ calendarConfigJson: CUSTOM_CALENDAR });

      const validRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'A 40-day Frostwane event',
          startDateJson: { year: 5, month: 1, day: 40 },
          datePrecision: 'day',
        });
      expect(validRes.status).toBe(201);

      const invalidRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'A day too far into Frostwane',
          startDateJson: { year: 5, month: 1, day: 41 },
          datePrecision: 'day',
        });
      expect(invalidRes.status).toBe(400);
    });

    it('rejects an end date before the start date', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline End Before Start Campaign',
      );
      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Backwards Event',
          startDateJson: { year: 10, month: 6, day: 1 },
          endDateJson: { year: 10, month: 1, day: 1 },
          datePrecision: 'day',
        });
      expect(res.status).toBe(400);
    });

    it('rejects changing the campaign calendar in a way that invalidates an existing event date', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Calendar Change Guard Campaign',
      );
      await createEvent(token, campaign.id, {
        startDateJson: { year: 1, month: 2, day: 28 },
        datePrecision: 'day',
      });

      const shrinkingCalendar = {
        schemaVersion: 1,
        months: [{ name: 'OnlyMonth', days: 10 }],
      };
      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ calendarConfigJson: shrinkingCalendar });
      expect(res.status).toBe(409);
    });
  });

  describe('sorting and undated section', () => {
    it('sorts dated events chronologically and always after them, undated events by creation order', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Sort Campaign',
      );
      const later = await createEvent(token, campaign.id, {
        title: 'Later Event',
        startDateJson: { year: 200 },
        datePrecision: 'year',
      });
      const earlier = await createEvent(token, campaign.id, {
        title: 'Earlier Event',
        startDateJson: { year: 100 },
        datePrecision: 'year',
      });
      const undated = await createEvent(token, campaign.id, {
        title: 'Undated Event',
      });

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`);
      const list = body<TimelineEventSummary[]>(listRes);
      const ids = list.map((e) => e.id);
      expect(ids.indexOf(earlier.id)).toBeLessThan(ids.indexOf(later.id));
      expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(undated.id));
    });
  });

  describe('entity, session, and tag links', () => {
    it('links an event to entities, sessions, and tags, and rejects a cross-campaign entity', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Links Campaign',
      );
      const entity = await createEntity(token, campaign.id, {
        name: 'Cedric',
      });
      const session = await createSession(token, campaign.id);

      const created = await createEvent(token, campaign.id, {
        entityIds: [entity.id],
        sessionIds: [session.id],
        tags: ['omen', 'foreshadowing'],
      });
      expect(created.entities.map((e) => e.id)).toEqual([entity.id]);
      expect(created.sessions.map((s) => s.id)).toEqual([session.id]);
      expect(created.tags.sort()).toEqual(['foreshadowing', 'omen']);

      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Timeline Links Campaign B');
      const outsider = await createEntity(tokenB, campaignB.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Bad Link', entityIds: [outsider.id] });
      expect(res.status).toBe(400);
    });

    it('filters the list by linked entity', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Filter Campaign',
      );
      const entity = await createEntity(token, campaign.id);
      const linked = await createEvent(token, campaign.id, {
        title: 'Linked Event',
        entityIds: [entity.id],
      });
      await createEvent(token, campaign.id, { title: 'Unlinked Event' });

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline?entityId=${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      const list = body<TimelineEventSummary[]>(res);
      expect(list.map((e) => e.id)).toEqual([linked.id]);
    });
  });

  describe('visibility', () => {
    it('hides a gm_only event from a player but shows it to the owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Visibility Campaign',
      );
      const player = await addMember(
        campaign.id,
        'visibility-player',
        'player',
      );
      const event = await createEvent(token, campaign.id, {
        visibility: 'gm_only',
      });

      const playerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline/${event.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerGet.status).toBe(404);

      const playerList = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(
        body<TimelineEventSummary[]>(playerList).some((e) => e.id === event.id),
      ).toBe(false);

      const ownerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/timeline/${event.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(ownerGet.status).toBe(200);
    });
  });

  describe('search integration', () => {
    it('finds a public timeline event by title and respects gm_only visibility', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Timeline Search Campaign',
      );
      const player = await addMember(campaign.id, 'search-player', 'player');
      await createEvent(token, campaign.id, {
        title: 'The Sundering of Blackwall',
      });
      await createEvent(token, campaign.id, {
        title: 'Secret Sundering Council',
        visibility: 'gm_only',
      });

      const ownerRes = await request(app.getHttpServer())
        .get(
          `/campaigns/${campaign.id}/search?q=Sundering&types=timeline_event`,
        )
        .set('Authorization', `Bearer ${token}`);
      expect(body<SearchResponse>(ownerRes).results).toHaveLength(2);

      const playerRes = await request(app.getHttpServer())
        .get(
          `/campaigns/${campaign.id}/search?q=Sundering&types=timeline_event`,
        )
        .set('Authorization', `Bearer ${player.token}`);
      const playerResults = body<SearchResponse>(playerRes).results;
      expect(playerResults).toHaveLength(1);
      expect(playerResults[0]?.title).toBe('The Sundering of Blackwall');
    });
  });
});
