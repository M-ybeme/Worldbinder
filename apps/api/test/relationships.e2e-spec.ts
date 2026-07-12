import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  EntityRelationship,
  EntityRelationshipView,
  RelationshipType,
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

const TEST_EMAIL_DOMAIN = 'relationships-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Relationships (e2e)', () => {
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
      .send({
        entityType: 'character',
        name: 'Fixture Entity',
        ...overrides,
      });
    return body<EntityDetail>(res);
  }

  async function requireBuiltInType(
    token: string,
    campaignId: string,
    key: string,
  ): Promise<RelationshipType> {
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/relationship-types`)
      .set('Authorization', `Bearer ${token}`);
    const type = body<RelationshipType[]>(res).find((t) => t.key === key);
    if (!type) throw new Error(`Built-in relationship type "${key}" missing`);
    return type;
  }

  describe('built-in relationship types', () => {
    it('are provisioned and visible to every campaign', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Built-in Types Campaign',
      );
      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/relationship-types`)
        .set('Authorization', `Bearer ${token}`);
      const types = body<RelationshipType[]>(res);

      const controls = types.find((t) => t.key === 'controls');
      expect(controls).toBeDefined();
      expect(controls?.forwardLabel).toBe('Controls');
      expect(controls?.reverseLabel).toBe('Controlled by');
      expect(controls?.campaignId).toBeNull();
    });
  });

  describe('create and reverse projection', () => {
    it('creates a relationship and projects the reverse label on the target entity', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Reverse Projection Campaign',
      );
      const duke = await createEntity(token, campaign.id, {
        name: 'Duke Renald',
      });
      const westvale = await createEntity(token, campaign.id, {
        name: 'Westvale',
        entityType: 'location',
      });
      const controls = await requireBuiltInType(token, campaign.id, 'controls');

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: duke.id,
          targetEntityId: westvale.id,
          relationshipTypeId: controls.id,
        });
      expect(createRes.status).toBe(201);
      const created = body<EntityRelationship>(createRes);
      expect(created.visibility).toBe('public');

      const dukeView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${duke.id}/relationships`)
        .set('Authorization', `Bearer ${token}`);
      const dukeRelationships = body<EntityRelationshipView[]>(dukeView);
      const dukeOutgoing = dukeRelationships.find(
        (r) => r.direction === 'outgoing' && r.otherEntity.id === westvale.id,
      );
      expect(dukeOutgoing?.label).toBe('Controls');

      const westvaleView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${westvale.id}/relationships`)
        .set('Authorization', `Bearer ${token}`);
      const westvaleRelationships =
        body<EntityRelationshipView[]>(westvaleView);
      const westvaleIncoming = westvaleRelationships.find(
        (r) => r.direction === 'incoming' && r.otherEntity.id === duke.id,
      );
      expect(westvaleIncoming?.label).toBe('Controlled by');
    });
  });

  describe('validation', () => {
    it('rejects a relationship whose source/target entity belongs to another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Cross-Campaign A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Cross-Campaign B');

      const entityA = await createEntity(tokenA, campaignA.id);
      const entityB = await createEntity(tokenB, campaignB.id);
      const type = await requireBuiltInType(tokenA, campaignA.id, 'ally_of');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaignA.id}/relationships`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          sourceEntityId: entityA.id,
          targetEntityId: entityB.id,
          relationshipTypeId: type.id,
        });
      expect(res.status).toBe(404);
    });

    it('rejects a relationship type whose target-type allow-list excludes the target entity', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Type Compatibility Campaign',
      );
      const worshipper = await createEntity(token, campaign.id, {
        name: 'A Cleric',
      });
      const notADeity = await createEntity(token, campaign.id, {
        name: 'Not A Deity',
        entityType: 'location',
      });
      const worships = await requireBuiltInType(token, campaign.id, 'worships');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: worshipper.id,
          targetEntityId: notADeity.id,
          relationshipTypeId: worships.id,
        });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate relationship of the same type between the same entities', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Duplicate Campaign');
      const a = await createEntity(token, campaign.id, { name: 'A' });
      const b = await createEntity(token, campaign.id, { name: 'B' });
      const allyOf = await requireBuiltInType(token, campaign.id, 'ally_of');

      const first = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: allyOf.id,
        });
      expect(first.status).toBe(201);

      const duplicate = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: allyOf.id,
        });
      expect(duplicate.status).toBe(409);
    });

    it('rejects the swapped ordering of a symmetric relationship as a duplicate', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Symmetric Duplicate Campaign',
      );
      const a = await createEntity(token, campaign.id, { name: 'A' });
      const b = await createEntity(token, campaign.id, { name: 'B' });
      const allyOf = await requireBuiltInType(token, campaign.id, 'ally_of');

      const first = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: allyOf.id,
        });
      expect(first.status).toBe(201);

      const swapped = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: b.id,
          targetEntityId: a.id,
          relationshipTypeId: allyOf.id,
        });
      expect(swapped.status).toBe(409);
    });

    it('allows the swapped ordering for an asymmetric type (not a duplicate)', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Asymmetric Non-Duplicate Campaign',
      );
      const a = await createEntity(token, campaign.id, { name: 'A' });
      const b = await createEntity(token, campaign.id, { name: 'B' });
      const parentOf = await requireBuiltInType(
        token,
        campaign.id,
        'parent_of',
      );

      const first = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: parentOf.id,
        });
      expect(first.status).toBe(201);

      const swapped = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: b.id,
          targetEntityId: a.id,
          relationshipTypeId: parentOf.id,
        });
      expect(swapped.status).toBe(201);
    });

    it('rejects a player from creating a relationship', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Player Cannot Create Relationship',
      );
      const player = await addMember(campaign.id, 'player', 'player');
      const a = await createEntity(token, campaign.id, { name: 'A' });
      const b = await createEntity(token, campaign.id, { name: 'B' });
      const allyOf = await requireBuiltInType(token, campaign.id, 'ally_of');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: allyOf.id,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('visibility leaks', () => {
    it('hides a gm_only relationship from a player', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Hidden Relationship Campaign',
      );
      const player = await addMember(
        campaign.id,
        'player-hidden-rel',
        'player',
      );
      const a = await createEntity(token, campaign.id, { name: 'A' });
      const b = await createEntity(token, campaign.id, { name: 'B' });
      const allyOf = await requireBuiltInType(token, campaign.id, 'ally_of');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: a.id,
          targetEntityId: b.id,
          relationshipTypeId: allyOf.id,
          visibility: 'gm_only',
        });

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${a.id}/relationships`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<EntityRelationshipView[]>(playerView)).toEqual([]);

      const ownerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${a.id}/relationships`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<EntityRelationshipView[]>(ownerView).length).toBe(1);
    });

    it('hides a public relationship whose other endpoint is a gm_only entity', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Hidden Endpoint Campaign',
      );
      const player = await addMember(
        campaign.id,
        'player-hidden-endpoint',
        'player',
      );
      const visible = await createEntity(token, campaign.id, {
        name: 'Visible Entity',
      });
      const hidden = await createEntity(token, campaign.id, {
        name: 'Hidden Entity',
        visibility: 'gm_only',
      });
      const allyOf = await requireBuiltInType(token, campaign.id, 'ally_of');

      await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceEntityId: visible.id,
          targetEntityId: hidden.id,
          relationshipTypeId: allyOf.id,
        });

      const playerView = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/entities/${visible.id}/relationships`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<EntityRelationshipView[]>(playerView)).toEqual([]);
    });
  });

  describe('custom relationship types', () => {
    it('creates a custom type scoped to the campaign and rejects a duplicate key', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Custom Type Campaign',
      );

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationship-types`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'sworn_to_secrecy',
          forwardLabel: 'Sworn to secrecy with',
          reverseLabel: 'Sworn to secrecy with',
          symmetric: true,
        });
      expect(createRes.status).toBe(201);
      expect(body<RelationshipType>(createRes).campaignId).toBe(campaign.id);

      const duplicateRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/relationship-types`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'sworn_to_secrecy',
          forwardLabel: 'Different label',
          reverseLabel: 'Different label',
        });
      expect(duplicateRes.status).toBe(409);
    });
  });
});
