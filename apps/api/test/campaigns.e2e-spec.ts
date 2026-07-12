import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDashboard,
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  CampaignSummary,
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

const TEST_EMAIL_DOMAIN = 'campaigns-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Campaigns (e2e)', () => {
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

    // Other e2e suites in this run share the same dev Redis and IP-scoped
    // login rate limit — clear it so this suite's many logins aren't
    // starved by attempts already made in auth.e2e-spec.ts.
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

  describe('create and list', () => {
    it('creates a campaign and makes the creator its owner', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('The Sunken Archive');

      expect(campaign.name).toBe('The Sunken Archive');
      expect(campaign.role).toBe('owner');
      expect(campaign.status).toBe('draft');
      expect(campaign.slug).toEqual(expect.any(String));

      const listRes = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.status).toBe(200);
      const list = body<CampaignSummary[]>(listRes);
      expect(list.some((c) => c.id === campaign.id)).toBe(true);
    });

    it('does not list campaigns the caller has no membership in', async () => {
      const { campaign: campaignA } =
        await createOwnerAndCampaign('Campaign A');
      const { token: tokenB } = await createOwnerAndCampaign('Campaign B');

      const listRes = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${tokenB}`);

      const list = body<CampaignSummary[]>(listRes);
      expect(list.some((c) => c.id === campaignA.id)).toBe(false);
    });
  });

  describe('cross-campaign isolation', () => {
    it('returns 404 (not 403) for a non-member fetching another campaign', async () => {
      const { campaign } = await createOwnerAndCampaign('Private Campaign');
      const { token: outsiderToken } = await createOwnerAndCampaign(
        'Outsider Home Campaign',
      );

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-member trying to update another campaign', async () => {
      const { campaign } = await createOwnerAndCampaign('Guarded Campaign');
      const { token: outsiderToken } = await createOwnerAndCampaign(
        'Outsider Home Campaign 2',
      );

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ description: 'hijacked' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-existent campaign id', async () => {
      const { token } = await createOwnerAndCampaign('Some Campaign');
      const res = await request(app.getHttpServer())
        .get('/campaigns/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for a malformed campaign id rather than a database error', async () => {
      const { token } = await createOwnerAndCampaign('Some Other Campaign');
      const res = await request(app.getHttpServer())
        .get('/campaigns/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('settings updates', () => {
    it('lets the owner rename the campaign', async () => {
      const { token, campaign } = await createOwnerAndCampaign('Old Name');

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(body<CampaignDetail>(res).name).toBe('New Name');
    });
  });

  describe('archive and restore', () => {
    it('archives and then restores a campaign', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Archivable Campaign',
      );

      const archiveRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/archive`)
        .set('Authorization', `Bearer ${token}`);
      expect(archiveRes.status).toBe(200);

      const afterArchive = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<CampaignDetail>(afterArchive).status).toBe('archived');

      const restoreRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/restore`)
        .set('Authorization', `Bearer ${token}`);
      expect(restoreRes.status).toBe(200);

      const afterRestore = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<CampaignDetail>(afterRestore).status).toBe('active');
    });
  });

  describe('owner-only actions', () => {
    it('forbids a non-owner (gm) from deleting the campaign', async () => {
      const { token: ownerToken, campaign } = await createOwnerAndCampaign(
        'Owner Guarded Campaign',
      );

      const gmPassword = 'gm-password-123';
      const gm = await createVerifiedUser(
        db,
        passwords,
        gmPassword,
        uniqueEmail(TEST_EMAIL_DOMAIN, 'gm'),
      );
      // Directly insert the membership row — invitation flow is covered in
      // membership.e2e-spec.ts; this suite only needs a non-owner member.
      await db
        .insert(campaignMembers)
        .values({ campaignId: campaign.id, userId: gm.id, role: 'gm' });
      const gmToken = await loginAs(gm.email, gmPassword);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${gmToken}`);
      expect(deleteRes.status).toBe(403);

      const deleteAsOwner = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(deleteAsOwner.status).toBe(200);

      const afterDelete = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(afterDelete.status).toBe(404);
    });
  });

  describe('dashboard', () => {
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

    async function completeSession(
      token: string,
      campaignId: string,
      session: CampaignSessionDetail,
    ): Promise<void> {
      await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/sessions/${session.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ updatedAt: session.updatedAt });
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

    it('picks the upcoming and last-played sessions, and surfaces a thread neglected for 3+ sessions', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Dashboard Campaign');

      const thread = await createThread(token, campaign.id, {
        title: 'Neglected Thread',
      });

      const session1 = await createSession(token, campaign.id, {
        title: 'Session One',
        plotThreadChanges: [{ plotThreadId: thread.id, action: 'introduced' }],
      });
      await completeSession(token, campaign.id, session1);

      for (let i = 2; i <= 4; i += 1) {
        const session = await createSession(token, campaign.id, {
          title: `Session ${i}`,
        });
        await completeSession(token, campaign.id, session);
      }

      const upcoming = await createSession(token, campaign.id, {
        title: 'Upcoming Session',
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      const dashboardRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/dashboard`)
        .set('Authorization', `Bearer ${token}`);
      expect(dashboardRes.status).toBe(200);
      const dashboard = body<CampaignDashboard>(dashboardRes);

      expect(dashboard.upcomingSession?.id).toBe(upcoming.id);
      expect(dashboard.lastPlayedSession?.title).toBe('Session 4');
      expect(dashboard.neglectedThreads.some((t) => t.id === thread.id)).toBe(
        true,
      );
    });

    it("omits gm_only threads and sessions from a player's dashboard", async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Player Dashboard Campaign',
      );
      const player = await addMember(campaign.id, 'dashboard-player', 'player');

      const hiddenThread = await createThread(token, campaign.id, {
        title: 'Hidden Thread',
        visibility: 'gm_only',
      });
      const hiddenSession = await createSession(token, campaign.id, {
        title: 'Hidden Session',
        visibility: 'gm_only',
      });
      await completeSession(token, campaign.id, hiddenSession);

      const ownerDashboardRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/dashboard`)
        .set('Authorization', `Bearer ${token}`);
      const ownerDashboard = body<CampaignDashboard>(ownerDashboardRes);
      expect(
        ownerDashboard.activeThreads.some((t) => t.id === hiddenThread.id),
      ).toBe(true);
      expect(
        ownerDashboard.recentActivity.some((a) => a.id === hiddenSession.id),
      ).toBe(true);

      const playerDashboardRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/dashboard`)
        .set('Authorization', `Bearer ${player.token}`);
      const playerDashboard = body<CampaignDashboard>(playerDashboardRes);
      expect(
        playerDashboard.activeThreads.some((t) => t.id === hiddenThread.id),
      ).toBe(false);
      expect(
        playerDashboard.recentActivity.some((a) => a.id === hiddenSession.id),
      ).toBe(false);
      expect(playerDashboard.lastPlayedSession?.id).not.toBe(hiddenSession.id);
    });
  });
});
