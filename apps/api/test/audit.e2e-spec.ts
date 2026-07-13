import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignAuditEvent,
  CampaignDetail,
  CampaignRole,
  CampaignSessionDetail,
  EntityDetail,
  MembershipSummary,
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

const TEST_EMAIL_DOMAIN = 'audit-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Campaign audit log (e2e)', () => {
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
  ): Promise<{ token: string; userId: string }> {
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
    return { token, userId: user.id };
  }

  function listAudit(
    token: string,
    campaignId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/audit`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('rejects a player from viewing the audit log (owner/gm-only)', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Player Gate Campaign',
    );
    const player = await addMember(campaign.id, 'gate-player', 'player');
    await listAudit(token, campaign.id); // sanity: owner can hit this route

    const res = await listAudit(player.token, campaign.id);
    expect(res.status).toBe(403);
  });

  it('records member_role_changed and member_removed', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Membership Campaign',
    );
    const target = await addMember(campaign.id, 'role-target', 'player');

    const membersRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/members`)
      .set('Authorization', `Bearer ${token}`);
    const membershipRow = body<MembershipSummary[]>(membersRes).find(
      (m) => m.userId === target.userId,
    )!;

    const roleRes = await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.id}/members/${membershipRow.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'editor' });
    expect(roleRes.status).toBe(200);

    const removeRes = await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.id}/members/${membershipRow.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removeRes.status).toBe(200);

    const auditRes = await listAudit(token, campaign.id);
    const events = body<CampaignAuditEvent[]>(auditRes);
    expect(events.some((e) => e.type === 'member_role_changed')).toBe(true);
    expect(events.some((e) => e.type === 'member_removed')).toBe(true);
    // Records cannot be edited/deleted through any exposed API — no PATCH/DELETE
    // route exists on the audit controller at all (structural guarantee).
  });

  it('records content_revealed on session reveal', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Reveal Campaign',
    );
    const entityRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/entities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        entityType: 'character',
        name: 'Hidden NPC',
        visibility: 'gm_only',
      });
    const entity = body<EntityDetail>(entityRes);

    const sessionRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Reveal Session' });
    const session = body<CampaignSessionDetail>(sessionRes);

    const revealRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/sessions/${session.id}/reveals`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityId: entity.id });
    expect(revealRes.status).toBe(201);

    const auditRes = await listAudit(token, campaign.id);
    const events = body<CampaignAuditEvent[]>(auditRes);
    const revealEvent = events.find((e) => e.type === 'content_revealed');
    expect(revealEvent).toBeDefined();
    expect(revealEvent!.targetResourceId).toBe(entity.id);
    // Metadata never carries content bodies (roadmap §11.14).
    expect(JSON.stringify(revealEvent!.metadataJson ?? {})).not.toContain(
      'Hidden NPC',
    );
  });

  it('records revision_restored', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Restore Campaign',
    );
    const entityRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/entities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'character', name: 'Restorable NPC' });
    const entity = body<EntityDetail>(entityRes);

    const revisionsRes = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.id}/revisions/entity/${entity.id}`)
      .set('Authorization', `Bearer ${token}`);
    const revisionId = body<{ id: string }[]>(revisionsRes)[0].id;

    const restoreRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/revisions/${revisionId}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.status).toBe(200);

    const auditRes = await listAudit(token, campaign.id);
    const events = body<CampaignAuditEvent[]>(auditRes);
    const restoreEvent = events.find((e) => e.type === 'revision_restored');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent!.targetResourceType).toBe('entity');
    expect(restoreEvent!.targetResourceId).toBe(entity.id);
  });

  it('records campaign_archived', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Archive Campaign',
    );

    const archiveRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(archiveRes.status).toBe(200);

    const auditRes = await listAudit(token, campaign.id);
    const events = body<CampaignAuditEvent[]>(auditRes);
    expect(events.some((e) => e.type === 'campaign_archived')).toBe(true);
  });

  it('records destructive_action on entity deletion', async () => {
    const { token, campaign } = await createOwnerAndCampaign(
      'Audit Destructive Campaign',
    );
    const entityRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.id}/entities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'character', name: 'Doomed NPC' });
    const entity = body<EntityDetail>(entityRes);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.id}/entities/${entity.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const auditRes = await listAudit(token, campaign.id);
    const events = body<CampaignAuditEvent[]>(auditRes);
    const destructiveEvent = events.find(
      (e) =>
        e.type === 'destructive_action' && e.targetResourceId === entity.id,
    );
    expect(destructiveEvent).toBeDefined();
    expect(destructiveEvent!.targetResourceType).toBe('entity');
  });
});
