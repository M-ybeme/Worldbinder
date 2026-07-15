import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AttachmentSummary,
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  PresignedUploadResponse,
} from '@worldbinder/contracts';
import { eq, like } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import {
  DRIZZLE,
  PG_POOL,
  type Database,
} from '../src/database/database.module';
import { attachments, campaignMembers, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'attachments-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let passwords: PasswordService;
  let pool: Pool;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = moduleFixture.get(DRIZZLE);
    passwords = moduleFixture.get(PasswordService);
    pool = moduleFixture.get(PG_POOL);

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

  async function presign(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/attachments/presign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'fixture.png',
        declaredMimeType: 'image/png',
        sizeBytes: 100,
        ...overrides,
      });
  }

  /** Real presign -> real PUT straight to MinIO -> real complete() —
   * exercises the actual storage integration, not a mock. Returns the
   * attachment id with status 'uploaded'. */
  async function uploadAndComplete(
    token: string,
    campaignId: string,
    bytes: Buffer = Buffer.from('fixture bytes'),
  ): Promise<string> {
    const presignRes = await presign(token, campaignId, {
      sizeBytes: bytes.byteLength,
    });
    expect(presignRes.status).toBe(201);
    const { attachmentId, uploadUrl } =
      body<PresignedUploadResponse>(presignRes);

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(bytes),
    });
    expect(putRes.ok).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/attachments/${attachmentId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(completeRes.status).toBe(201);
    expect(body<AttachmentSummary>(completeRes).status).toBe('uploaded');

    return attachmentId;
  }

  /** Simulates the worker finishing processing — the worker's own actual
   * magic-byte/hash/dimension logic is covered by apps/worker's unit tests
   * (with injected fakes); this e2e suite verifies the API surface built
   * on top of the resulting `ready` state, not the detection logic itself. */
  async function markReady(
    attachmentId: string,
    mimeType = 'image/png',
  ): Promise<void> {
    await db
      .update(attachments)
      .set({
        status: 'ready',
        detectedMimeType: mimeType,
        sha256: 'deadbeef',
        width: mimeType.startsWith('image/') ? 10 : null,
        height: mimeType.startsWith('image/') ? 10 : null,
      })
      .where(eq(attachments.id, attachmentId));
  }

  describe('presign validation and permissions', () => {
    it('rejects a declared size over the configured maximum', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Size Campaign',
      );
      const res = await presign(token, campaign.id, { sizeBytes: 21_000_000 });
      expect(res.status).toBe(400);
    });

    it('rejects a declared MIME type outside the allowlist', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment MIME Campaign',
      );
      const res = await presign(token, campaign.id, {
        declaredMimeType: 'application/x-msdownload',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a player from presigning an upload', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Attachment Player Presign Campaign',
      );
      const player = await addMember(campaign.id, 'presign-player', 'player');
      const res = await presign(player.token, campaign.id);
      expect(res.status).toBe(403);
    });
  });

  describe('complete()', () => {
    it('verifies the real object exists in storage and transitions to uploaded', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Complete Campaign',
      );
      const attachmentId = await uploadAndComplete(token, campaign.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<AttachmentSummary>(res).status).toBe('uploaded');
    });

    it('rejects completing an attachment that was never actually uploaded', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment No Upload Campaign',
      );
      const presignRes = await presign(token, campaign.id);
      const { attachmentId } = body<PresignedUploadResponse>(presignRes);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('rejects completing an already-completed attachment (409)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Double Complete Campaign',
      );
      const attachmentId = await uploadAndComplete(token, campaign.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
    });
  });

  describe('link / unlink / resource-scoped list', () => {
    it('rejects linking an attachment that is not yet ready', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Link Not Ready Campaign',
      );
      const entity = await createEntity(token, campaign.id);
      const attachmentId = await uploadAndComplete(token, campaign.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({ resourceType: 'entity', resourceId: entity.id });
      expect(res.status).toBe(409);
    });

    it('links a ready attachment and it appears in the resource-scoped list with its caption', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Link Campaign',
      );
      const entity = await createEntity(token, campaign.id);
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);

      const linkRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          resourceType: 'entity',
          resourceId: entity.id,
          caption: 'portrait',
        });
      expect(linkRes.status).toBe(201);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      const list = body<AttachmentSummary[]>(listRes);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(attachmentId);
      expect(list[0].caption).toBe('portrait');
      expect(list[0].downloadUrl).toBeTruthy();

      const unlinkRes = await request(app.getHttpServer())
        .delete(
          `/campaigns/${campaign.id}/attachments/${attachmentId}/link/entity/${entity.id}`,
        )
        .set('Authorization', `Bearer ${token}`);
      expect(unlinkRes.status).toBe(200);

      const afterUnlink = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<AttachmentSummary[]>(afterUnlink)).toHaveLength(0);
    });

    it('rejects linking an attachment to a resource in a different campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Attachment Cross Campaign A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Attachment Cross Campaign B');
      const entityInB = await createEntity(tokenB, campaignB.id);
      const attachmentId = await uploadAndComplete(tokenA, campaignA.id);
      await markReady(attachmentId);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resourceType: 'entity', resourceId: entityInB.id });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an attachment id scoped to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Attachment Wrong Campaign A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Attachment Wrong Campaign B');
      const attachmentId = await uploadAndComplete(tokenA, campaignA.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('hides attachments linked to a gm_only entity from a player but shows them to the owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Visibility Campaign',
      );
      const player = await addMember(
        campaign.id,
        'visibility-player',
        'player',
      );
      const entity = await createEntity(token, campaign.id, {
        visibility: 'gm_only',
      });
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({ resourceType: 'entity', resourceId: entity.id });

      const playerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerRes.status).toBe(404);

      const ownerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<AttachmentSummary[]>(ownerRes)).toHaveLength(1);
    });
  });

  describe('unlinked-attachments management list', () => {
    it('lists an uploaded-but-unlinked attachment for owner/gm/editor but rejects a player', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Unlinked Campaign',
      );
      const player = await addMember(campaign.id, 'unlinked-player', 'player');
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);

      const ownerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments`)
        .set('Authorization', `Bearer ${token}`);
      expect(
        body<AttachmentSummary[]>(ownerRes).some((a) => a.id === attachmentId),
      ).toBe(true);

      const playerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerRes.status).toBe(403);
    });
  });

  describe('delete', () => {
    it('soft-deletes an attachment, removes it from resource lists, and records a destructive_action audit event', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Delete Campaign',
      );
      const entity = await createEntity(token, campaign.id);
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);
      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({ resourceType: 'entity', resourceId: entity.id });

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const listRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<AttachmentSummary[]>(listRes)).toHaveLength(0);

      const auditRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/audit`)
        .set('Authorization', `Bearer ${token}`);
      const events =
        body<{ type: string; targetResourceType: string | null }[]>(auditRes);
      expect(
        events.some(
          (e) =>
            e.type === 'destructive_action' &&
            e.targetResourceType === 'attachment',
        ),
      ).toBe(true);
    });

    it('rejects a player from deleting an attachment', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Delete Player Campaign',
      );
      const player = await addMember(campaign.id, 'delete-player', 'player');
      const attachmentId = await uploadAndComplete(token, campaign.id);

      const res = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('campaign cover image', () => {
    it('rejects a not-ready attachment as a cover image', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Cover Not Ready Campaign',
      );
      const attachmentId = await uploadAndComplete(token, campaign.id);

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ coverAttachmentId: attachmentId });
      expect(res.status).toBe(403);
    });

    it('rejects a non-image ready attachment as a cover image', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Cover Non Image Campaign',
      );
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId, 'application/pdf');

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ coverAttachmentId: attachmentId });
      expect(res.status).toBe(403);
    });

    it('sets a ready image as the cover, visible to every active member regardless of role', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Attachment Cover Campaign',
      );
      const player = await addMember(campaign.id, 'cover-player', 'player');
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);

      const patchRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ coverAttachmentId: attachmentId });
      expect(patchRes.status).toBe(200);
      expect(body<CampaignDetail>(patchRes).coverImageUrl).toBeTruthy();

      const playerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<CampaignDetail>(playerRes).coverImageUrl).toBeTruthy();
    });

    it('rejects a cover image attachment id from another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Attachment Cover Cross A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Attachment Cover Cross B');
      const attachmentId = await uploadAndComplete(tokenB, campaignB.id);
      await markReady(attachmentId);

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaignA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ coverAttachmentId: attachmentId });
      expect(res.status).toBe(404);
    });
  });

  describe('N+1 regression (Milestone 14 Phase 6)', () => {
    async function campaignWithReadyCover(
      token: string,
      name: string,
    ): Promise<void> {
      const campaign = body<CampaignDetail>(
        await request(app.getHttpServer())
          .post('/campaigns')
          .set('Authorization', `Bearer ${token}`)
          .send({ name }),
      );
      const attachmentId = await uploadAndComplete(token, campaign.id);
      await markReady(attachmentId);
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ coverAttachmentId: attachmentId });
    }

    /** Counts real SQL round trips (not drizzle query-builder calls) by
     * spying on the shared pg Pool's `.query`, so the assertion below is
     * about actual database traffic, not implementation detail. */
    async function countQueriesDuringList(token: string): Promise<number> {
      let count = 0;
      const original = pool.query.bind(pool);
      const spy = jest
        .spyOn(pool, 'query')
        .mockImplementation((...args: unknown[]) => {
          count += 1;
          return (original as (...a: unknown[]) => unknown)(...args);
        });

      await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${token}`);

      spy.mockRestore();
      return count;
    }

    it('resolves cover images for a campaign list with a query count that does not scale with the number of campaigns', async () => {
      const { token } = await createOwnerAndCampaign('N+1 Regression Baseline');
      await campaignWithReadyCover(token, 'N+1 Regression Cover A');

      const countWithOneCover = await countQueriesDuringList(token);

      await campaignWithReadyCover(token, 'N+1 Regression Cover B');
      await campaignWithReadyCover(token, 'N+1 Regression Cover C');

      const countWithThreeCovers = await countQueriesDuringList(token);

      expect(countWithThreeCovers).toBe(countWithOneCover);
    });
  });
});
