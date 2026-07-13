import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  RevisionSummary,
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

const TEST_EMAIL_DOMAIN = 'revisions-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Revisions (e2e)', () => {
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

  function patchEntity(
    token: string,
    campaignId: string,
    entityId: string,
    updatedAt: string,
    overrides: Record<string, unknown>,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}/entities/${entityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'character', updatedAt, ...overrides });
  }

  function listRevisions(
    token: string,
    campaignId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/revisions/${resourceType}/${resourceId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function restoreRevision(
    token: string,
    campaignId: string,
    revisionId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/revisions/${revisionId}/restore`)
      .set('Authorization', `Bearer ${token}`);
  }

  describe('recording and merge-window grouping', () => {
    it('creates one revision on create, and merges a same-actor same-window edit into it', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Merge Campaign',
      );
      const created = await createEntity(token, campaign.id, {
        summary: 'First summary.',
      });

      const afterCreate = await listRevisions(
        token,
        campaign.id,
        'entity',
        created.id,
      );
      expect(afterCreate.status).toBe(200);
      const afterCreateRevisions = body<RevisionSummary[]>(afterCreate);
      expect(afterCreateRevisions).toHaveLength(1);
      expect(afterCreateRevisions[0].revisionNumber).toBe(1);

      const updateRes = await patchEntity(
        token,
        campaign.id,
        created.id,
        created.updatedAt,
        { summary: 'Edited summary.' },
      );
      expect(updateRes.status).toBe(200);

      const afterEdit = await listRevisions(
        token,
        campaign.id,
        'entity',
        created.id,
      );
      const afterEditRevisions = body<RevisionSummary[]>(afterEdit);
      // Same actor, same resource, within the merge window: still one row.
      expect(afterEditRevisions).toHaveLength(1);
      expect(afterEditRevisions[0].revisionNumber).toBe(1);
      expect(
        (afterEditRevisions[0].snapshotJson as { summaryPlainText?: string })
          .summaryPlainText,
      ).toBeUndefined(); // summary isn't a CONTENT_FIELDS entry, only *ContentJson fields get plain-text extracts
    });

    it('creates a new revision when a different actor edits the same resource', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Distinct Actor Campaign',
      );
      const editor = await addMember(campaign.id, 'editor', 'editor');
      const created = await createEntity(token, campaign.id, {
        summary: 'Owner summary.',
      });

      const editRes = await patchEntity(
        editor.token,
        campaign.id,
        created.id,
        created.updatedAt,
        { summary: 'Editor summary.' },
      );
      expect(editRes.status).toBe(200);

      const list = await listRevisions(
        token,
        campaign.id,
        'entity',
        created.id,
      );
      const revisions = body<RevisionSummary[]>(list);
      expect(revisions).toHaveLength(2);
      expect(revisions.map((r) => r.revisionNumber).sort()).toEqual([1, 2]);
    });
  });

  describe('restore', () => {
    it('always creates a new, distinct revision — even immediately after the restoring actor edited', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Restore Campaign',
      );
      const editor = await addMember(campaign.id, 'restore-editor', 'editor');

      const created = await createEntity(token, campaign.id, {
        summary: 'Original summary.',
      });
      // Different actor: forces a genuinely distinct revision #2, so #1's
      // snapshot is never overwritten by a same-actor merge.
      const editByOther = await patchEntity(
        editor.token,
        campaign.id,
        created.id,
        created.updatedAt,
        { summary: 'Changed by editor.' },
      );
      expect(editByOther.status).toBe(200);
      const afterEditByOther = body<EntityDetail>(editByOther);

      // Owner makes their own edit right before restoring, opening a merge
      // window under the owner's own actor id.
      const ownerQuickEdit = await patchEntity(
        token,
        campaign.id,
        created.id,
        afterEditByOther.updatedAt,
        { summary: 'Owner quick edit.' },
      );
      expect(ownerQuickEdit.status).toBe(200);

      const beforeRestore = body<RevisionSummary[]>(
        await listRevisions(token, campaign.id, 'entity', created.id),
      );
      expect(beforeRestore).toHaveLength(3);
      const revisionOne = beforeRestore.find((r) => r.revisionNumber === 1)!;
      const latestBeforeRestore = beforeRestore.find(
        (r) => r.revisionNumber === 3,
      )!;

      const restoreRes = await restoreRevision(
        token,
        campaign.id,
        revisionOne.id,
      );
      expect(restoreRes.status).toBe(200);

      const afterRestore = body<RevisionSummary[]>(
        await listRevisions(token, campaign.id, 'entity', created.id),
      );
      // Restore must never merge into the restoring actor's own recent edit
      // window — a 4th, distinct revision appears rather than #3 mutating.
      expect(afterRestore).toHaveLength(4);
      const restored = afterRestore.find((r) => r.revisionNumber === 4)!;
      expect(restored.changeSummary).toBe(
        `Restored from revision #${revisionOne.revisionNumber}`,
      );
      const stillRevisionThree = afterRestore.find(
        (r) => r.revisionNumber === 3,
      )!;
      expect(stillRevisionThree.changeSummary).toBe(
        latestBeforeRestore.changeSummary,
      );

      const entityRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<EntityDetail>(entityRes).summary).toBe('Original summary.');
    });

    it('rejects restore onto a deleted resource but keeps its history listable', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Deleted Resource Campaign',
      );
      const created = await createEntity(token, campaign.id);

      const listBeforeDelete = body<RevisionSummary[]>(
        await listRevisions(token, campaign.id, 'entity', created.id),
      );
      const revisionId = listBeforeDelete[0].id;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/entities/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      // History stays viewable after deletion.
      const listAfterDelete = await listRevisions(
        token,
        campaign.id,
        'entity',
        created.id,
      );
      expect(listAfterDelete.status).toBe(200);
      expect(body<RevisionSummary[]>(listAfterDelete)).toHaveLength(1);

      const restoreRes = await restoreRevision(token, campaign.id, revisionId);
      expect(restoreRes.status).toBe(409);
    });

    it('rejects a player from restoring a revision (403, delegated to the owning resource update permission)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Player Restore Campaign',
      );
      const player = await addMember(campaign.id, 'restore-player', 'player');
      const created = await createEntity(token, campaign.id);
      const list = body<RevisionSummary[]>(
        await listRevisions(token, campaign.id, 'entity', created.id),
      );

      const res = await restoreRevision(player.token, campaign.id, list[0].id);
      expect(res.status).toBe(403);
    });
  });

  describe('cross-campaign isolation', () => {
    it('returns 404 listing revisions for a resource id scoped to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Revision Isolation A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Revision Isolation B');
      const created = await createEntity(tokenA, campaignA.id);

      const res = await listRevisions(
        tokenB,
        campaignB.id,
        'entity',
        created.id,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 restoring a revision id scoped to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Revision Restore Isolation A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Revision Restore Isolation B');
      const created = await createEntity(tokenA, campaignA.id);
      const list = body<RevisionSummary[]>(
        await listRevisions(tokenA, campaignA.id, 'entity', created.id),
      );

      const res = await restoreRevision(tokenB, campaignB.id, list[0].id);
      expect(res.status).toBe(404);
    });
  });

  describe('GM-content omission', () => {
    it('omits gmContentJson from a player-viewed revision but includes it for the owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision GM Field Campaign',
      );
      const player = await addMember(campaign.id, 'gm-field-player', 'player');
      const created = await createEntity(token, campaign.id, {
        gmContentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      const ownerList = body<RevisionSummary[]>(
        await listRevisions(token, campaign.id, 'entity', created.id),
      );
      expect(ownerList[0].snapshotJson).toHaveProperty('gmContentJson');

      const playerList = body<RevisionSummary[]>(
        await listRevisions(player.token, campaign.id, 'entity', created.id),
      );
      expect(playerList[0].snapshotJson).not.toHaveProperty('gmContentJson');
    });

    it('hides revision history entirely for a resource the player cannot view (404, not empty list)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Revision Visibility Campaign',
      );
      const player = await addMember(
        campaign.id,
        'hidden-revision-player',
        'player',
      );
      const created = await createEntity(token, campaign.id, {
        visibility: 'gm_only',
      });

      const res = await listRevisions(
        player.token,
        campaign.id,
        'entity',
        created.id,
      );
      expect(res.status).toBe(404);
    });
  });
});
