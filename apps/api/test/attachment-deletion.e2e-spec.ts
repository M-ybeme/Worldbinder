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
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { attachments, campaignMembers, users } from '../src/database/schema';
import { REDIS } from '../src/redis/redis.module';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'attachment-deletion-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

/**
 * A stored file can be linked to several entries, sessions and threads and
 * be a map's image or a campaign's cover. Deleting it permanently must never
 * take it from another place by accident; removing one link (and restoring
 * it, for Undo) must leave the file intact. Its own file so its logins stay
 * within the per-spec login rate limit.
 */
describe('Attachment deletion and shared files (e2e)', () => {
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

  async function readyAndLink(
    token: string,
    campaignId: string,
    resources: { resourceType: string; resourceId: string }[],
  ): Promise<string> {
    const attachmentId = await uploadAndComplete(token, campaignId);
    await markReady(attachmentId);
    for (const resource of resources) {
      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/attachments/${attachmentId}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send(resource);
      expect(res.status).toBeLessThan(300);
    }
    return attachmentId;
  }

  it('refuses to delete a file another entry also uses, and says how many places', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Attachment Shared Delete Campaign',
    );
    const blackwall = await createEntity(token, campaign.id);
    const march = await createEntity(token, campaign.id);
    const attachmentId = await readyAndLink(token, campaign.id, [
      { resourceType: 'entity', resourceId: blackwall.id },
      { resourceType: 'entity', resourceId: march.id },
    ]);

    const list = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/attachments/entity/${blackwall.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(body<AttachmentSummary[]>(list)[0]?.usedElsewhereCount).toBe(1);

    for (const query of [
      `?resourceType=entity&resourceId=${blackwall.id}`,
      '',
    ]) {
      const res = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/attachments/${attachmentId}${query}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'ATTACHMENT_IN_USE',
        usedElsewhereCount: 1,
      });
    }

    // Nothing was deleted: both entries still list it, downloadable.
    for (const entityId of [blackwall.id, march.id]) {
      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/attachments/entity/${entityId}`)
        .set('Authorization', `Bearer ${token}`);
      const [attachment] = body<AttachmentSummary[]>(res);
      expect(attachment?.id).toBe(attachmentId);
      expect(attachment?.downloadUrl).toBeTruthy();
    }

    // Removed from the other entry, it can be deleted from this one.
    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaign.id}/attachments/${attachmentId}/link/entity/${march.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaign.id}/attachments/${attachmentId}?resourceType=entity&resourceId=${blackwall.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('counts a campaign cover and a map image as uses', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Attachment Cover Map Delete Campaign',
    );
    const entity = await createEntity(token, campaign.id);
    const asCover = await readyAndLink(token, campaign.id, [
      { resourceType: 'entity', resourceId: entity.id },
    ]);
    await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ coverAttachmentId: asCover })
      .expect(200);

    const asMap = await readyAndLink(token, campaign.id, [
      { resourceType: 'entity', resourceId: entity.id },
    ]);
    const map = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/maps`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Northern March' });
    await request(app.getHttpServer())
      .patch(
        `/campaigns/${campaign.id}/maps/${(map.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ imageAttachmentId: asMap })
      .expect(200);

    for (const attachmentId of [asCover, asMap]) {
      const res = await request(app.getHttpServer())
        .delete(
          `/campaigns/${campaign.id}/attachments/${attachmentId}?resourceType=entity&resourceId=${entity.id}`,
        )
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ usedElsewhereCount: 1 });
    }
  });

  it('ignores uses on deleted entries, and hides the count from players', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Attachment Deleted Use Campaign',
    );
    const player = await addMember(campaign.id, 'count-player', 'player');
    const kept = await createEntity(token, campaign.id);
    const removed = await createEntity(token, campaign.id);
    const attachmentId = await readyAndLink(token, campaign.id, [
      { resourceType: 'entity', resourceId: kept.id },
      { resourceType: 'entity', resourceId: removed.id },
    ]);

    const playerList = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/attachments/entity/${kept.id}`)
      .set('Authorization', `Bearer ${player.token}`);
    expect(body<AttachmentSummary[]>(playerList)[0]).not.toHaveProperty(
      'usedElsewhereCount',
    );

    await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.id}/entities/${removed.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaign.id}/attachments/${attachmentId}?resourceType=entity&resourceId=${kept.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('a removed link can be restored with its caption (Undo)', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Attachment Relink Campaign',
    );
    const entity = await createEntity(token, campaign.id);
    const attachmentId = await uploadAndComplete(token, campaign.id);
    await markReady(attachmentId);
    const link = {
      resourceType: 'entity',
      resourceId: entity.id,
      caption: 'Town map, autumn 1287',
      displayOrder: 2,
    };
    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
      .set('Authorization', `Bearer ${token}`)
      .send(link)
      .expect(201);
    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaign.id}/attachments/${attachmentId}/link/entity/${entity.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`)
      .set('Authorization', `Bearer ${token}`)
      .send(link)
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/attachments/entity/${entity.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(body<AttachmentSummary[]>(res)[0]).toMatchObject({
      id: attachmentId,
      caption: 'Town map, autumn 1287',
      displayOrder: 2,
    });
  });
});
