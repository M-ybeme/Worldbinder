import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntityDetail,
  EntityRelationshipView,
  PlotThreadDetail,
  RelationshipType,
} from '@worldbinder/contracts';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { campaignMembers, plotThreads, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'sessions-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Sessions (e2e)', () => {
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
  ): Promise<{ token: string; campaignMemberId: string }> {
    const password = 'member-password-123';
    const user = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, label),
    );
    const [member] = await db
      .insert(campaignMembers)
      .values({ campaignId, userId: user.id, role })
      .returning({ id: campaignMembers.id });
    const token = await loginAs(user.email, password);
    return { token, campaignMemberId: member?.id ?? '' };
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

  describe('create, get, update, delete', () => {
    it('creates a session with an auto-assigned sequential session number', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Session CRUD Campaign',
      );

      const first = await createSession(token, campaign.id, {
        title: 'Session One',
      });
      expect(first.sessionNumber).toBe(1);
      expect(first.status).toBe('planned');

      const second = await createSession(token, campaign.id, {
        title: 'Session Two',
      });
      expect(second.sessionNumber).toBe(2);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${first.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<CampaignSessionDetail>(getRes).title).toBe('Session One');
    });

    it('updates a session and rejects a stale update', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Session Update Campaign',
      );
      const created = await createSession(token, campaign.id);

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, title: 'Updated Title' });
      expect(updateRes.status).toBe(200);
      expect(body<CampaignSessionDetail>(updateRes).title).toBe(
        'Updated Title',
      );

      const staleRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, title: 'Conflicting Title' });
      expect(staleRes.status).toBe(409);
      expect(body<{ code: string }>(staleRes).code).toBe('STALE_UPDATE');
    });

    it('deletes a session and excludes it from get/list afterward', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Session Delete Campaign',
      );
      const created = await createSession(token, campaign.id);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('rejects a player from creating a session', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Player Cannot Create Session',
      );
      const player = await addMember(campaign.id, 'player', 'player');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ title: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for a session fetched through another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Session Isolation A');
      const { campaign: campaignB } = await createOwnerAndCampaign(
        'Session Isolation B',
      );
      const created = await createSession(tokenA, campaignA.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('join-table full-replace sync', () => {
    it('syncs participants, featured entities, and locations, and rejects a non-location entity as a location', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Session Join Sync Campaign',
      );
      const player = await addMember(campaign.id, 'sync-player', 'player');
      const character = await createEntity(token, campaign.id, {
        name: 'A Character',
      });
      const location = await createEntity(token, campaign.id, {
        name: 'A Location',
        entityType: 'location',
      });

      const created = await createSession(token, campaign.id, {
        participantIds: [player.campaignMemberId],
        featuredEntityIds: [character.id],
        locationEntityIds: [location.id],
      });

      expect(created.participants).toHaveLength(1);
      expect(created.participants[0]?.campaignMemberId).toBe(
        player.campaignMemberId,
      );
      expect(created.featuredEntities.map((e) => e.id)).toEqual([character.id]);
      expect(created.locations.map((e) => e.id)).toEqual([location.id]);

      const rejectRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          updatedAt: created.updatedAt,
          locationEntityIds: [character.id],
        });
      expect(rejectRes.status).toBe(400);

      const clearRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, featuredEntityIds: [] });
      expect(clearRes.status).toBe(200);
      expect(body<CampaignSessionDetail>(clearRes).featuredEntities).toEqual(
        [],
      );
    });

    it('rejects a featured entity id that belongs to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Cross-Campaign Session Entity A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Cross-Campaign Session Entity B');
      const outsider = await createEntity(tokenB, campaignB.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/sessions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Nope', featuredEntityIds: [outsider.id] });
      expect(res.status).toBe(400);
    });
  });

  describe('visibility', () => {
    it('hides a gm_only session from a player (404, not 403)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'GM Only Session Campaign',
      );
      const player = await addMember(
        campaign.id,
        'hidden-session-player',
        'player',
      );
      const created = await createSession(token, campaign.id, {
        visibility: 'gm_only',
      });

      const playerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerGet.status).toBe(404);

      const playerList = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(
        body<CampaignSessionSummary[]>(playerList).some(
          (s) => s.id === created.id,
        ),
      ).toBe(false);
    });

    it('omits plannedContentJson and gmContentJson for a player', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'GM Content Session Campaign',
      );
      const player = await addMember(
        campaign.id,
        'gm-content-player',
        'player',
      );
      const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
      const created = await createSession(token, campaign.id, {
        plannedContentJson: doc,
      });
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt, gmContentJson: doc });

      const ownerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(
        body<CampaignSessionDetail>(ownerView).plannedContentJson,
      ).toBeDefined();
      expect(
        body<CampaignSessionDetail>(ownerView).gmContentJson,
      ).toBeDefined();

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${created.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerView.body).not.toHaveProperty('plannedContentJson');
      expect(playerView.body).not.toHaveProperty('gmContentJson');
    });
  });

  describe('complete', () => {
    it('atomically completes a session and advances the campaign world date', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Complete Session Campaign',
      );
      const created = await createSession(token, campaign.id);
      const worldEndDateJson = {
        schemaVersion: 1,
        year: 1428,
        month: 6,
        day: 12,
      };

      const completeRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${created.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          updatedAt: created.updatedAt,
          worldEndDateJson,
          recapContentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
        });
      expect(completeRes.status).toBe(201);
      const completed = body<CampaignSessionDetail>(completeRes);
      expect(completed.status).toBe('completed');
      expect(completed.playedAt).not.toBeNull();
      expect(completed.worldEndDateJson).toEqual(worldEndDateJson);

      const campaignRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<CampaignDetail>(campaignRes).currentWorldDateJson).toEqual(
        worldEndDateJson,
      );
    });

    it('rejects completing an already-completed session', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Double Complete Campaign',
      );
      const created = await createSession(token, campaign.id);

      const first = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${created.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: created.updatedAt });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${created.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: body<CampaignSessionDetail>(first).updatedAt });
      expect(second.status).toBe(409);
    });
  });

  describe('reveal', () => {
    it('flips a gm_only entity to public, is idempotent-guarded, and unlocks its relationships/backlinks', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Reveal Campaign');
      const player = await addMember(campaign.id, 'reveal-player', 'player');
      const session = await createSession(token, campaign.id);

      const secret = await createEntity(token, campaign.id, {
        name: 'Secret NPC',
        visibility: 'gm_only',
      });
      const known = await createEntity(token, campaign.id, {
        name: 'Known NPC',
      });

      const typesRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/relationship-types`)
        .set('Authorization', `Bearer ${token}`);
      const allyOf = body<RelationshipType[]>(typesRes).find(
        (t) => t.key === 'ally_of',
      );
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: known.id,
          targetEntityId: secret.id,
          relationshipTypeId: allyOf?.id,
        });

      const beforeReveal = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${known.id}/relationships`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<EntityRelationshipView[]>(beforeReveal)).toEqual([]);

      const revealRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${session.id}/reveals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ entityId: secret.id });
      expect(revealRes.status).toBe(201);

      const secretView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${secret.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(secretView.status).toBe(200);

      const afterReveal = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${known.id}/relationships`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<EntityRelationshipView[]>(afterReveal).length).toBe(1);

      const sessionDetail = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(
        body<CampaignSessionDetail>(sessionDetail).reveals.map((e) => e.id),
      ).toEqual([secret.id]);

      const duplicateReveal = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${session.id}/reveals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ entityId: secret.id });
      expect(duplicateReveal.status).toBe(400);
    });

    it('rejects an editor from revealing content', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Reveal Permission Campaign',
      );
      const editor = await addMember(campaign.id, 'reveal-editor', 'editor');
      const session = await createSession(token, campaign.id);
      const secret = await createEntity(token, campaign.id, {
        name: 'Editor Cannot Reveal',
        visibility: 'gm_only',
      });

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/sessions/${session.id}/reveals`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ entityId: secret.id });
      expect(res.status).toBe(403);
    });
  });

  describe('entity session appearances', () => {
    it('returns sessions via both featured-entity and location links, hiding a gm_only session from a player', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Session Appearances Campaign',
      );
      const player = await addMember(
        campaign.id,
        'appearances-player',
        'player',
      );
      const npc = await createEntity(token, campaign.id, {
        name: 'Featured NPC',
      });
      const location = await createEntity(token, campaign.id, {
        name: 'Visited Location',
        entityType: 'location',
      });

      const publicSession = await createSession(token, campaign.id, {
        title: 'Public Session',
        featuredEntityIds: [npc.id],
      });
      const hiddenSession = await createSession(token, campaign.id, {
        title: 'Hidden Session',
        visibility: 'gm_only',
        locationEntityIds: [location.id],
      });
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${publicSession.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          updatedAt: publicSession.updatedAt,
          locationEntityIds: [location.id],
        });

      const ownerAppearances = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${location.id}/sessions`)
        .set('Authorization', `Bearer ${token}`);
      const ownerIds = body<CampaignSessionSummary[]>(ownerAppearances).map(
        (s) => s.id,
      );
      expect(ownerIds.sort()).toEqual(
        [publicSession.id, hiddenSession.id].sort(),
      );

      const playerAppearances = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${location.id}/sessions`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(
        body<CampaignSessionSummary[]>(playerAppearances).map((s) => s.id),
      ).toEqual([publicSession.id]);
    });
  });

  describe('plot thread linking', () => {
    it('introducing sets introducedSessionId only on the first link; resolving sets status + resolvedSessionId; any action bumps lastReferencedSessionId to the newer session', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Linking Campaign',
      );
      const thread = await createThread(token, campaign.id);

      const session1 = await createSession(token, campaign.id, {
        title: 'Session One',
        plotThreadChanges: [{ plotThreadId: thread.id, action: 'introduced' }],
      });

      let [row] = await db
        .select()
        .from(plotThreads)
        .where(eq(plotThreads.id, thread.id));
      expect(row?.introducedSessionId).toBe(session1.id);
      expect(row?.lastReferencedSessionId).toBe(session1.id);

      // Re-introducing on a later session must not move introducedSessionId,
      // but does bump lastReferencedSessionId (a higher session number).
      const session2 = await createSession(token, campaign.id, {
        title: 'Session Two',
        plotThreadChanges: [{ plotThreadId: thread.id, action: 'introduced' }],
      });

      [row] = await db
        .select()
        .from(plotThreads)
        .where(eq(plotThreads.id, thread.id));
      expect(row?.introducedSessionId).toBe(session1.id);
      expect(row?.lastReferencedSessionId).toBe(session2.id);

      const session3 = await createSession(token, campaign.id, {
        title: 'Session Three',
        plotThreadChanges: [{ plotThreadId: thread.id, action: 'resolved' }],
      });

      [row] = await db
        .select()
        .from(plotThreads)
        .where(eq(plotThreads.id, thread.id));
      expect(row?.status).toBe('resolved');
      expect(row?.resolvedSessionId).toBe(session3.id);
      expect(row?.lastReferencedSessionId).toBe(session3.id);

      const detailRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${thread.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<PlotThreadDetail>(detailRes).sessions).toHaveLength(3);
    });

    it('unlinking a plot thread from a session does not retroactively clear lastReferencedSessionId (documented simplification)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Unlink Campaign',
      );
      const thread = await createThread(token, campaign.id);

      const session = await createSession(token, campaign.id, {
        title: 'Session One',
        plotThreadChanges: [{ plotThreadId: thread.id, action: 'advanced' }],
      });

      let [row] = await db
        .select()
        .from(plotThreads)
        .where(eq(plotThreads.id, thread.id));
      expect(row?.lastReferencedSessionId).toBe(session.id);

      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: session.updatedAt, plotThreadChanges: [] });

      [row] = await db
        .select()
        .from(plotThreads)
        .where(eq(plotThreads.id, thread.id));
      expect(row?.lastReferencedSessionId).toBe(session.id);

      const detailRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/plot-threads/${thread.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<PlotThreadDetail>(detailRes).sessions).toEqual([]);
    });

    it('rejects linking a plot thread that belongs to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Cross-Campaign Thread Link A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Cross-Campaign Thread Link B');
      const outsiderThread = await createThread(tokenB, campaignB.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/sessions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Nope',
          plotThreadChanges: [
            { plotThreadId: outsiderThread.id, action: 'introduced' },
          ],
        });
      expect(res.status).toBe(400);
    });

    it('a player only sees plotThreadChanges entries whose thread they can see', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Thread Link Visibility Campaign',
      );
      const player = await addMember(
        campaign.id,
        'thread-link-player',
        'player',
      );

      const publicThread = await createThread(token, campaign.id, {
        title: 'Public Thread',
      });
      const hiddenThread = await createThread(token, campaign.id, {
        title: 'Hidden Thread',
        visibility: 'gm_only',
      });

      const session = await createSession(token, campaign.id, {
        title: 'Mixed Session',
        plotThreadChanges: [
          { plotThreadId: publicThread.id, action: 'introduced' },
          { plotThreadId: hiddenThread.id, action: 'introduced' },
        ],
      });

      const ownerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(
        body<CampaignSessionDetail>(ownerView).plotThreadChanges,
      ).toHaveLength(2);

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/sessions/${session.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      const playerChanges =
        body<CampaignSessionDetail>(playerView).plotThreadChanges;
      expect(playerChanges).toHaveLength(1);
      expect(playerChanges[0]?.plotThread.id).toBe(publicThread.id);
    });
  });
});
