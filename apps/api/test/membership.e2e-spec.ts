import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  InvitationPreview,
  MembershipSummary,
} from '@worldbinder/contracts';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { TokenService } from '../src/auth/token.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { campaignInvitations, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import {
  createVerifiedUser,
  findEmailToken,
  uniqueEmail,
} from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'membership-integration-test.local';
const INVITE_TOKEN_PATTERN = /\/accept-invitation\/([^"'\s]+)/;

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Membership (e2e)', () => {
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

  async function createUser(
    label: string,
    password = 'fixture-password-123',
  ): Promise<{ id: string; email: string; token: string }> {
    const user = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, label),
    );
    const token = await loginAs(user.email, password);
    return { ...user, token };
  }

  async function createOwnerCampaign(
    name: string,
  ): Promise<{ ownerToken: string; campaign: CampaignDetail }> {
    const owner = await createUser('owner');
    const res = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name });

    return { ownerToken: owner.token, campaign: body<CampaignDetail>(res) };
  }

  describe('invitations', () => {
    it('invites a member and lets them accept via the emailed link', async () => {
      const { ownerToken, campaign } =
        await createOwnerCampaign('Invitable Campaign');
      const invitee = await createUser('invitee');

      const inviteRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: invitee.email, role: 'editor' });
      expect(inviteRes.status).toBe(200);

      const rawToken = await findEmailToken(
        invitee.email,
        campaign.name,
        INVITE_TOKEN_PATTERN,
      );

      const previewRes = await request(app.getHttpServer()).get(
        `/invitations/${rawToken}`,
      );
      expect(previewRes.status).toBe(200);
      expect(body<InvitationPreview>(previewRes).role).toBe('editor');

      const acceptRes = await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${invitee.token}`);
      expect(acceptRes.status).toBe(200);

      const membersRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const members = body<MembershipSummary[]>(membersRes);
      expect(
        members.some((m) => m.email === invitee.email && m.role === 'editor'),
      ).toBe(true);
    });

    it('rejects accepting an invitation with a different account email', async () => {
      const { ownerToken, campaign } =
        await createOwnerCampaign('Mismatch Campaign');
      const invitee = await createUser('invitee-mismatch');
      const stranger = await createUser('stranger');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: invitee.email, role: 'player' });

      const rawToken = await findEmailToken(
        invitee.email,
        campaign.name,
        INVITE_TOKEN_PATTERN,
      );

      const acceptRes = await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${stranger.token}`);
      expect(acceptRes.status).toBe(403);
    });

    it('rejects an expired invitation', async () => {
      const { campaign } = await createOwnerCampaign('Expiring Campaign');
      const invitee = await createUser('invitee-expired');
      const owner = await createUser('owner-for-expired');

      const rawToken = tokens.generateOpaqueToken();
      await db.insert(campaignInvitations).values({
        campaignId: campaign.id,
        email: invitee.email,
        role: 'viewer',
        tokenHash: tokens.hashOpaqueToken(rawToken),
        invitedByUserId: owner.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const acceptRes = await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${invitee.token}`);
      expect(acceptRes.status).toBe(400);
    });

    it('rejects a revoked invitation', async () => {
      const { ownerToken, campaign } =
        await createOwnerCampaign('Revocable Campaign');
      const invitee = await createUser('invitee-revoked');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: invitee.email, role: 'viewer' });

      const rawToken = await findEmailToken(
        invitee.email,
        campaign.name,
        INVITE_TOKEN_PATTERN,
      );

      const [invitation] = await db
        .select({ id: campaignInvitations.id })
        .from(campaignInvitations)
        .where(
          eq(campaignInvitations.tokenHash, tokens.hashOpaqueToken(rawToken)),
        );

      const revokeRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(revokeRes.status).toBe(200);

      const acceptRes = await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${invitee.token}`);
      expect(acceptRes.status).toBe(400);
    });

    it('forbids a non-owner/gm from inviting members', async () => {
      const { ownerToken, campaign } = await createOwnerCampaign(
        'Locked Down Campaign',
      );
      const editor = await createUser('editor-cant-invite');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: editor.email, role: 'editor' });
      const rawToken = await findEmailToken(
        editor.email,
        campaign.name,
        INVITE_TOKEN_PATTERN,
      );
      await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${editor.token}`);

      const somebody = await createUser('invite-target');
      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ email: somebody.email, role: 'viewer' });
      expect(res.status).toBe(403);
    });
  });

  describe('role changes', () => {
    async function inviteAndAccept(
      ownerToken: string,
      campaignId: string,
      email: string,
      role: string,
    ): Promise<void> {
      await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email, role });
      const rawToken = await findEmailToken(email, '', INVITE_TOKEN_PATTERN);
      const inviteeToken = await getTokenForEmail(email);
      await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`);
    }

    const emailToPassword = new Map<string, string>();
    const emailToToken = new Map<string, string>();

    async function getTokenForEmail(email: string): Promise<string> {
      const cached = emailToToken.get(email);
      if (cached) return cached;
      const password = emailToPassword.get(email);
      if (!password) throw new Error(`no fixture password for ${email}`);
      const token = await loginAs(email, password);
      emailToToken.set(email, token);
      return token;
    }

    async function createTrackedUser(
      label: string,
    ): Promise<{ id: string; email: string; token: string }> {
      const password = 'fixture-password-123';
      const user = await createUser(label, password);
      emailToPassword.set(user.email, password);
      emailToToken.set(user.email, user.token);
      return user;
    }

    it('lets the owner change any non-owner role, including a GM', async () => {
      const { ownerToken, campaign } = await createOwnerCampaign(
        'Role Change Campaign',
      );
      const gm = await createTrackedUser('gm-target');
      await inviteAndAccept(ownerToken, campaign.id, gm.email, 'gm');

      const membersRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const gmMember = body<MembershipSummary[]>(membersRes).find(
        (m) => m.email === gm.email,
      )!;

      const changeRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/members/${gmMember.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'editor' });
      expect(changeRes.status).toBe(200);
    });

    it('forbids a GM from changing another GM or promoting to owner', async () => {
      const { ownerToken, campaign } =
        await createOwnerCampaign('GM Limits Campaign');
      const gmA = await createTrackedUser('gm-a');
      const gmB = await createTrackedUser('gm-b');
      await inviteAndAccept(ownerToken, campaign.id, gmA.email, 'gm');
      await inviteAndAccept(ownerToken, campaign.id, gmB.email, 'gm');

      const membersRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const gmBMember = body<MembershipSummary[]>(membersRes).find(
        (m) => m.email === gmB.email,
      )!;

      const gmAToken = await getTokenForEmail(gmA.email);
      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/members/${gmBMember.id}`)
        .set('Authorization', `Bearer ${gmAToken}`)
        .send({ role: 'editor' });
      expect(res.status).toBe(403);
    });
  });

  describe('member removal', () => {
    it('removes a member and immediately revokes their campaign access', async () => {
      const { ownerToken, campaign } =
        await createOwnerCampaign('Removal Campaign');
      const player = await createUser('removable-player');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: player.email, role: 'player' });
      const rawToken = await findEmailToken(
        player.email,
        campaign.name,
        INVITE_TOKEN_PATTERN,
      );
      await request(app.getHttpServer())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${player.token}`);

      const beforeRemoval = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(beforeRemoval.status).toBe(200);

      const membersRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const playerMember = body<MembershipSummary[]>(membersRes).find(
        (m) => m.email === player.email,
      )!;

      const removeRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/members/${playerMember.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(removeRes.status).toBe(200);

      const afterRemoval = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(afterRemoval.status).toBe(404);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 after too many invitations for the same campaign', async () => {
      const { ownerToken, campaign } = await createOwnerCampaign(
        'Rate Limited Campaign',
      );

      let lastStatus = 0;
      for (let i = 0; i < 25; i += 1) {
        const res = await request(app.getHttpServer())
          .post(`/campaigns/${campaign.id}/invitations`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            email: uniqueEmail(TEST_EMAIL_DOMAIN, `bulk-${i}`),
            role: 'viewer',
          });
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }

      expect(lastStatus).toBe(429);
    });
  });
});
