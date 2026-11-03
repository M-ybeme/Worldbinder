import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignSessionDetail,
  EntityDetail,
} from '@worldbinder/contracts';
import { eq, like, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { sessions, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'sessions-concurrency-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

/**
 * Session numbers are allocated per campaign as max + 1. Concurrent
 * creations (two tabs, two GMs, a retry) must each get their own number
 * instead of colliding on the (campaign_id, session_number) constraint.
 * Its own file because the bursts here would otherwise push the main
 * sessions spec past the per-IP global rate limit.
 */
describe('Session number allocation under concurrency (e2e)', () => {
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
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password });
    const token = body<AuthTokenResponse>(login).accessToken;

    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });
    return { token, campaign: body<CampaignDetail>(res) };
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

  function post(token: string, campaignId: string, send: object) {
    return request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send(send);
  }

  function numbersOf(responses: request.Response[]): number[] {
    return responses
      .map((res) => body<CampaignSessionDetail>(res).sessionNumber)
      .sort((a, b) => a - b);
  }

  it('gives two simultaneous creations distinct numbers', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Concurrent Pair Campaign',
    );
    const responses = await Promise.all([
      post(token, campaign.id, { title: 'Tab A' }),
      post(token, campaign.id, { title: 'Tab B' }),
    ]);
    expect(responses.map((res) => res.status)).toEqual([201, 201]);
    expect(numbersOf(responses)).toEqual([1, 2]);
  });

  it('gives many concurrent creations contiguous, distinct numbers', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Concurrent Many Campaign',
    );
    const responses = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        post(token, campaign.id, { title: `Burst ${i}` }),
      ),
    );
    expect(responses.map((res) => res.status)).toEqual(
      Array.from({ length: 15 }, () => 201),
    );
    expect(numbersOf(responses)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it('numbers each campaign independently when both create at once', async () => {
    const a = await createOwnerAndCampaign('Concurrent Campaign A');
    const b = await createOwnerAndCampaign('Concurrent Campaign B');
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 === 0
          ? post(a.token, a.campaign.id, { title: `A ${i}` })
          : post(b.token, b.campaign.id, { title: `B ${i}` }),
      ),
    );
    expect(responses.map((res) => res.status)).toEqual(
      Array.from({ length: 6 }, () => 201),
    );
    const forCampaign = (id: string) =>
      numbersOf(
        responses.filter(
          (res) => body<CampaignSessionDetail>(res).campaignId === id,
        ),
      );
    expect(forCampaign(a.campaign.id)).toEqual([1, 2, 3]);
    expect(forCampaign(b.campaign.id)).toEqual([1, 2, 3]);
  });

  it('keeps existing numbers and never reuses a deleted one', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Concurrent Existing Campaign',
    );
    const existing: CampaignSessionDetail[] = [];
    for (let i = 1; i <= 3; i += 1) {
      existing.push(
        await createSession(token, campaign.id, { title: `Old ${i}` }),
      );
    }
    const deleted = await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.id}/sessions/${existing[2].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBeLessThan(300);

    const responses = await Promise.all([
      post(token, campaign.id, { title: 'New A' }),
      post(token, campaign.id, { title: 'New B' }),
    ]);
    expect(numbersOf(responses)).toEqual([4, 5]);

    const rows = await db
      .select({ id: sessions.id, sessionNumber: sessions.sessionNumber })
      .from(sessions)
      .where(eq(sessions.campaignId, campaign.id));
    for (const old of existing) {
      expect(rows.find((row) => row.id === old.id)?.sessionNumber).toBe(
        old.sessionNumber,
      );
    }
  });

  it('a creation that fails mid-transaction leaves nothing behind', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Concurrent Failure Campaign',
    );
    const other = await createOwnerAndCampaign('Concurrent Failure Other');
    const foreignEntity = await request(app.getHttpServer())
      .post(`/campaigns/${other.campaign.id}/entities`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ entityType: 'character', name: 'Not yours' });
    const foreignId = body<EntityDetail>(foreignEntity).id;

    const responses = await Promise.all([
      post(token, campaign.id, { title: 'Good 1' }),
      // Fails inside the transaction, after its number was allocated.
      post(token, campaign.id, {
        title: 'Bad',
        featuredEntityIds: [foreignId],
      }),
      post(token, campaign.id, { title: 'Good 2' }),
    ]);
    expect(responses.map((res) => res.status)).toEqual([201, 400, 201]);

    const rows = await db
      .select({
        title: sessions.title,
        sessionNumber: sessions.sessionNumber,
      })
      .from(sessions)
      .where(eq(sessions.campaignId, campaign.id));
    expect(rows.map((row) => row.title).sort()).toEqual(['Good 1', 'Good 2']);
    expect(rows.map((row) => row.sessionNumber).sort()).toEqual([1, 2]);
  });

  it('answers a number collision it could not prevent with a 409, not a 500', async () => {
    // A writer that bypasses the API's allocation (a script, a future code
    // path) holds an uncommitted session numbered 2. The API reads max = 1,
    // tries 2, waits on the unique index, and gets the violation once the
    // other writer commits.
    const { token, campaign } = await createOwnerAndCampaign(
      'Concurrent Collision Campaign',
    );
    await createSession(token, campaign.id, { title: 'One' });
    const [first] = await db
      .select({ userId: sessions.createdByUserId })
      .from(sessions)
      .where(eq(sessions.campaignId, campaign.id));

    let commitOther!: () => void;
    const otherMayCommit = new Promise<void>((resolve) => {
      commitOther = resolve;
    });
    let otherInserted!: () => void;
    const otherHasInserted = new Promise<void>((resolve) => {
      otherInserted = resolve;
    });
    const otherWriter = db.transaction(async (tx) => {
      await tx.insert(sessions).values({
        campaignId: campaign.id,
        sessionNumber: 2,
        title: 'Bypassing writer',
        createdByUserId: first.userId,
        updatedByUserId: first.userId,
      });
      otherInserted();
      await otherMayCommit;
    });
    await otherHasInserted;

    const apiCreate = post(token, campaign.id, { title: 'Two' }).then(
      (res) => res,
    );
    // Commit only once the API's insert is blocked on the unique index.
    for (;;) {
      const result = await db.execute(
        sql`select count(*)::int as n from pg_stat_activity
            where wait_event_type = 'Lock'
              and query ilike 'insert into "sessions"%'`,
      );
      const rows = (
        Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
      ) as { n: number }[];
      if (Number(rows[0]?.n ?? 0) > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    commitOther();
    await otherWriter;

    const res = await apiCreate;
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toMatch(/session number/i);
  });
});
