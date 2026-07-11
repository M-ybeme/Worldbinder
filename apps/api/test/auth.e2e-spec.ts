import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AuthTokenResponse, SessionSummary } from '@worldbinder/contracts';
import { randomUUID } from 'node:crypto';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { TokenService } from '../src/auth/token.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import {
  emailVerificationTokens,
  passwordResetTokens,
  securityEvents,
  userCredentials,
  users,
} from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';

const MAILPIT_URL = 'http://127.0.0.1:8025';
const TEST_EMAIL_DOMAIN = 'auth-integration-test.local';

interface MessageResponse {
  message: string;
}

function body<T>(res: request.Response): T {
  return res.body as T;
}

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

async function findEmailToken(
  email: string,
  subjectIncludes: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const list = (await listRes.json()) as {
      messages: { ID: string; Subject: string; To: { Address: string }[] }[];
    };

    const match = list.messages.find(
      (m) =>
        m.Subject.includes(subjectIncludes) &&
        m.To.some((t) => t.Address === email),
    );

    if (match) {
      const detailRes = await fetch(
        `${MAILPIT_URL}/api/v1/message/${match.ID}`,
      );
      const detail = (await detailRes.json()) as { HTML: string };
      const tokenMatch = /token=([^&"\s]+)/.exec(detail.HTML);
      if (tokenMatch) return decodeURIComponent(tokenMatch[1]);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(
    `No "${subjectIncludes}" email found for ${email} after polling Mailpit`,
  );
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let redis: Redis;
  let passwords: PasswordService;
  let tokens: TokenService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DRIZZLE);
    redis = moduleFixture.get(REDIS);
    passwords = moduleFixture.get(PasswordService);
    tokens = moduleFixture.get(TokenService);

    // Rate-limit counters persist in the shared dev Redis across local test
    // runs; clear them so this suite is deterministic regardless of history.
    const rateLimitKeys = await redis.keys('ratelimit:*');
    if (rateLimitKeys.length > 0) await redis.del(...rateLimitKeys);
  });

  afterAll(async () => {
    // Cascades to credentials/sessions/tokens/security events via FK onDelete rules.
    await db.delete(users).where(like(users.email, `%@${TEST_EMAIL_DOMAIN}`));
    await app.close();
  }, 15000);

  async function createVerifiedUser(
    password: string,
  ): Promise<{ id: string; email: string }> {
    const email = uniqueEmail('fixture');
    const [user] = await db
      .insert(users)
      .values({
        email,
        displayName: 'Fixture User',
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id, email: users.email });
    if (!user) throw new Error('failed to create fixture user');

    await db.insert(userCredentials).values({
      userId: user.id,
      passwordHash: await passwords.hash(password),
    });
    return user;
  }

  describe('full lifecycle: register -> verify -> login -> refresh -> reuse -> logout', () => {
    const email = uniqueEmail('lifecycle');
    const password = 'correct-horse-battery-staple';

    it('registers and sends a verification email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, displayName: 'Lifecycle User' });

      expect(res.status).toBe(200);
      expect(body<MessageResponse>(res).message).toMatch(/check your inbox/i);
    });

    it('rejects login before the email is verified', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      expect(res.status).toBe(403);
    });

    let verificationToken: string;

    it('verifies the email with the token from the sent email', async () => {
      verificationToken = await findEmailToken(email, 'Verify');
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: verificationToken });

      expect(res.status).toBe(200);
    });

    it('rejects reusing an already-consumed verification token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: verificationToken });

      expect(res.status).toBe(400);
    });

    let accessToken: string;
    let refreshCookie: string;

    it('logs in successfully once verified, setting a refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      const loginBody = body<AuthTokenResponse>(res);
      expect(loginBody.accessToken).toEqual(expect.any(String));
      expect(loginBody.user.emailVerified).toBe(true);

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const cookie = setCookie.find((c) =>
        c.startsWith('worldbinder_refresh='),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/auth/);

      accessToken = loginBody.accessToken;
      refreshCookie = cookie!.split(';')[0]!;
    });

    it('accepts the access token on a protected route', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const sessions = body<SessionSummary[]>(res);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.some((s) => s.current)).toBe(true);
    });

    it('rejects a protected route with no token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/sessions');
      expect(res.status).toBe(401);
    });

    let rotatedCookie: string;

    it('rotates the refresh token on /auth/refresh', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const cookie = setCookie.find((c) =>
        c.startsWith('worldbinder_refresh='),
      );
      expect(cookie).toBeDefined();
      expect(cookie).not.toEqual(refreshCookie);

      rotatedCookie = cookie!.split(';')[0]!;
    });

    it('detects reuse of the old (already-rotated) refresh token and revokes the family', async () => {
      const reuseRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie);
      expect(reuseRes.status).toBe(401);

      // The token that replaced it is now burned too — reuse revokes the whole family.
      const rotatedRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', rotatedCookie);
      expect(rotatedRes.status).toBe(401);
    });

    it('logs the reuse as a security event', async () => {
      const events = await db
        .select()
        .from(securityEvents)
        .where(eq(securityEvents.type, 'refresh_reuse_detected'));

      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('login', () => {
    it('rejects invalid credentials with a generic message', async () => {
      const user = await createVerifiedUser('right-password-123');
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(body<MessageResponse>(res).message).toMatch(
        /invalid email or password/i,
      );
    });

    it('rejects a login attempt for a nonexistent email with the same generic message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('ghost'), password: 'whatever-123' });

      expect(res.status).toBe(401);
      expect(body<MessageResponse>(res).message).toMatch(
        /invalid email or password/i,
      );
    });
  });

  describe('expired tokens', () => {
    it('rejects an expired email verification token', async () => {
      const user = await createVerifiedUser('irrelevant-123');
      const rawToken = tokens.generateOpaqueToken();
      await db.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: tokens.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: rawToken });
      expect(res.status).toBe(400);
    });

    it('rejects an expired password reset token', async () => {
      const user = await createVerifiedUser('irrelevant-123');
      const rawToken = tokens.generateOpaqueToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: tokens.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'new-password-123' });

      expect(res.status).toBe(400);
    });
  });

  describe('logout revokes the session', () => {
    it('makes the refresh token unusable after logout', async () => {
      const user = await createVerifiedUser('logout-flow-123');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'logout-flow-123' });

      const setCookie = loginRes.headers['set-cookie'] as unknown as string[];
      const cookie = setCookie
        .find((c) => c.startsWith('worldbinder_refresh='))!
        .split(';')[0];

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie);
      expect(logoutRes.status).toBe(200);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie);
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('password reset', () => {
    it('lets a user reset their password and invalidates old sessions', async () => {
      const user = await createVerifiedUser('old-password-123');

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'old-password-123' });
      const oldRefreshCookie = (
        loginRes.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith('worldbinder_refresh='))!
        .split(';')[0];

      const forgotRes = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: user.email });
      expect(forgotRes.status).toBe(200);

      const resetToken = await findEmailToken(user.email, 'Reset');
      const resetRes = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'new-password-456' });
      expect(resetRes.status).toBe(200);

      const oldPasswordLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'old-password-123' });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'new-password-456' });
      expect(newPasswordLogin.status).toBe(200);

      const staleRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldRefreshCookie);
      expect(staleRefresh.status).toBe(401);
    });
  });

  describe('change password', () => {
    it('requires the correct current password and revokes other sessions', async () => {
      const user = await createVerifiedUser('current-pass-123');

      const sessionA = body<AuthTokenResponse>(
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: user.email, password: 'current-pass-123' }),
      );
      const sessionBRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'current-pass-123' });

      const wrongCurrent = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({
          currentPassword: 'not-the-current-password',
          newPassword: 'new-pass-456',
        });
      expect(wrongCurrent.status).toBe(401);

      const changeRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .send({
          currentPassword: 'current-pass-123',
          newPassword: 'new-pass-456',
        });
      expect(changeRes.status).toBe(200);

      // Session A (used to change the password) stays valid...
      const sessionAStillWorks = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${sessionA.accessToken}`);
      expect(sessionAStillWorks.status).toBe(200);

      // ...but session B's refresh cookie should now be revoked.
      const sessionBCookie = (
        sessionBRes.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith('worldbinder_refresh='))!
        .split(';')[0];
      const sessionBRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', sessionBCookie);
      expect(sessionBRefresh.status).toBe(401);
    });
  });

  describe('session revocation', () => {
    it('lets a user revoke one of their own sessions by id, but not another user’s', async () => {
      const user = await createVerifiedUser('revoke-flow-123');
      const otherUser = await createVerifiedUser('other-user-123');

      const login = body<AuthTokenResponse>(
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: user.email, password: 'revoke-flow-123' }),
      );
      const otherLogin = body<AuthTokenResponse>(
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: otherUser.email, password: 'other-user-123' }),
      );

      const sessionsRes = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${login.accessToken}`);
      const sessionId = body<SessionSummary[]>(sessionsRes)[0].id;

      const forbidden = await request(app.getHttpServer())
        .delete(`/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${otherLogin.accessToken}`);
      expect(forbidden.status).toBe(404);

      const revoked = await request(app.getHttpServer())
        .delete(`/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${login.accessToken}`);
      expect(revoked.status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 after too many login attempts for the same IP+email', async () => {
      const user = await createVerifiedUser('rate-limit-target-123');

      let lastStatus = 0;
      for (let i = 0; i < 12; i += 1) {
        const res = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: user.email, password: 'wrong-password' });
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }

      expect(lastStatus).toBe(429);
    });
  });
});
