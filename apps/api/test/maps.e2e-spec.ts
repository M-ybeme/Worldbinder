import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTokenResponse,
  CampaignDetail,
  CampaignRole,
  EntityDetail,
  MapDetail,
  MapLayerSummary,
  MapPinSummary,
  MapSummary,
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

const TEST_EMAIL_DOMAIN = 'maps-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

describe('Maps (e2e)', () => {
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

  async function createMap(
    token: string,
    campaignId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<MapSummary> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/maps`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fixture Map', ...overrides });
    return body<MapSummary>(res);
  }

  async function createLayer(
    token: string,
    campaignId: string,
    mapId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<MapLayerSummary> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/maps/${mapId}/layers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fixture Layer', ...overrides });
    return body<MapLayerSummary>(res);
  }

  async function createPin(
    token: string,
    campaignId: string,
    mapId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<MapPinSummary> {
    const res = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/maps/${mapId}/pins`)
      .set('Authorization', `Bearer ${token}`)
      .send({ xNormalized: 0.5, yNormalized: 0.5, ...overrides });
    return body<MapPinSummary>(res);
  }

  /** Real presign -> real PUT straight to MinIO -> real complete(), then
   * fast-forwards to `ready` the same way attachments.e2e-spec.ts does —
   * the worker's own detection logic is covered by its own unit tests. */
  async function uploadReadyImage(
    token: string,
    campaignId: string,
  ): Promise<string> {
    const presignRes = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/attachments/presign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'fixture.png',
        declaredMimeType: 'image/png',
        sizeBytes: 13,
      });
    const { attachmentId, uploadUrl } =
      body<PresignedUploadResponse>(presignRes);

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(Buffer.from('fixture bytes')),
    });
    expect(putRes.ok).toBe(true);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/attachments/${attachmentId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    await db
      .update(attachments)
      .set({
        status: 'ready',
        detectedMimeType: 'image/png',
        sha256: 'deadbeef',
        width: 800,
        height: 600,
      })
      .where(eq(attachments.id, attachmentId));

    return attachmentId;
  }

  describe('map CRUD', () => {
    it('creates, gets, updates, and deletes a map', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Map CRUD Campaign');

      const createRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/maps`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'The Sunken City', description: 'Ruins offshore.' });
      expect(createRes.status).toBe(201);
      const created = body<MapSummary>(createRes);
      expect(created.name).toBe('The Sunken City');
      expect(created.visibility).toBe('public');

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(body<MapDetail>(getRes).layers).toEqual([]);
      expect(body<MapDetail>(getRes).pins).toEqual([]);

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/maps/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'The Sunken City (Renamed)', visibility: 'gm_only' });
      expect(updateRes.status).toBe(200);
      expect(body<MapDetail>(updateRes).name).toBe('The Sunken City (Renamed)');
      expect(body<MapDetail>(updateRes).visibility).toBe('gm_only');

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/maps/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const afterDelete = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(afterDelete.status).toBe(404);
    });

    it('rejects a player from creating a map', async () => {
      const { campaign } = await createOwnerAndCampaign(
        'Map Player Create Campaign',
      );
      const player = await addMember(campaign.id, 'create-player', 'player');

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/maps`)
        .set('Authorization', `Bearer ${player.token}`)
        .send({ name: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for a map fetched through another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Map Isolation A');
      const { campaign: campaignB } =
        await createOwnerAndCampaign('Map Isolation B');
      const created = await createMap(tokenA, campaignA.id);

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${campaignB.id}/maps/${created.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });

    it('deleting a map cascades to its layers and pins and records a destructive_action audit event', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Map Delete Cascade Campaign',
      );
      const map = await createMap(token, campaign.id);
      const layer = await createLayer(token, campaign.id, map.id);
      await createPin(token, campaign.id, map.id, { layerId: layer.id });

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);

      const auditRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/audit`)
        .set('Authorization', `Bearer ${token}`);
      const events =
        body<{ type: string; targetResourceType: string | null }[]>(auditRes);
      expect(
        events.some(
          (e) =>
            e.type === 'destructive_action' && e.targetResourceType === 'map',
        ),
      ).toBe(true);
    });
  });

  describe('layer CRUD', () => {
    it('creates, updates, and deletes a layer, and cross-campaign rejects', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Layer CRUD Campaign',
      );
      const map = await createMap(token, campaign.id);

      const layer = await createLayer(token, campaign.id, map.id, {
        name: 'Cities',
        displayOrder: 2,
      });
      expect(layer.name).toBe('Cities');

      const updateRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/maps/${map.id}/layers/${layer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Villages' });
      expect(updateRes.status).toBe(200);
      expect(body<MapLayerSummary>(updateRes).name).toBe('Villages');

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/maps/${map.id}/layers/${layer.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      const { campaign: campaignB } =
        await createOwnerAndCampaign('Layer Isolation B');
      const crossRes = await request(app.getHttpServer())
        .patch(`/campaigns/${campaignB.id}/maps/${map.id}/layers/${layer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });
      expect(crossRes.status).toBe(404);
    });

    it('deleting a layer ungroups (does not delete) its pins', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Layer Delete Ungroups Campaign',
      );
      const map = await createMap(token, campaign.id);
      const layer = await createLayer(token, campaign.id, map.id);
      const pin = await createPin(token, campaign.id, map.id, {
        layerId: layer.id,
      });

      await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/maps/${map.id}/layers/${layer.id}`)
        .set('Authorization', `Bearer ${token}`);

      const detailRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      const detail = body<MapDetail>(detailRes);
      const survivingPin = detail.pins.find((p) => p.id === pin.id);
      expect(survivingPin).toBeDefined();
      expect(survivingPin?.layerId).toBeNull();
    });
  });

  describe('pin CRUD and reposition', () => {
    it('creates a pin with and without a linked entity, updates it, and deletes it', async () => {
      const { token, campaign } =
        await createOwnerAndCampaign('Pin CRUD Campaign');
      const map = await createMap(token, campaign.id);
      const npc = await createEntity(token, campaign.id, { name: 'Cedric' });

      const linkedPin = await createPin(token, campaign.id, map.id, {
        locationEntityId: npc.id,
        xNormalized: 0.25,
        yNormalized: 0.75,
      });
      expect(linkedPin.locationEntityId).toBe(npc.id);
      expect(linkedPin.locationEntityName).toBe('Cedric');

      const freestandingPin = await createPin(token, campaign.id, map.id, {
        label: 'Here be dragons',
      });
      expect(freestandingPin.locationEntityId).toBeNull();
      expect(freestandingPin.label).toBe('Here be dragons');

      const updateRes = await request(app.getHttpServer())
        .patch(
          `/campaigns/${campaign.id}/maps/${map.id}/pins/${freestandingPin.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Here be worse dragons' });
      expect(updateRes.status).toBe(200);
      expect(body<MapPinSummary>(updateRes).label).toBe(
        'Here be worse dragons',
      );

      const deleteRes = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/maps/${map.id}/pins/${linkedPin.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);
    });

    it('rejects a pin linked to an entity from another campaign', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Pin Cross Campaign Entity A',
      );
      const map = await createMap(token, campaign.id);
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Pin Cross Campaign Entity B');
      const outsider = await createEntity(tokenB, campaignB.id);

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/maps/${map.id}/pins`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          xNormalized: 0.5,
          yNormalized: 0.5,
          locationEntityId: outsider.id,
        });
      expect(res.status).toBe(400);
    });

    it('the reposition endpoint updates only coordinates and rejects out-of-range values', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Pin Reposition Campaign',
      );
      const map = await createMap(token, campaign.id);
      const pin = await createPin(token, campaign.id, map.id, {
        label: 'Do not touch',
        visibility: 'gm_only',
      });

      const repositionRes = await request(app.getHttpServer())
        .patch(
          `/campaigns/${campaign.id}/maps/${map.id}/pins/${pin.id}/position`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ xNormalized: 0.9, yNormalized: 0.1 });
      expect(repositionRes.status).toBe(200);
      const repositioned = body<MapPinSummary>(repositionRes);
      expect(repositioned.xNormalized).toBe(0.9);
      expect(repositioned.yNormalized).toBe(0.1);
      expect(repositioned.label).toBe('Do not touch');
      expect(repositioned.visibility).toBe('gm_only');

      const outOfRangeRes = await request(app.getHttpServer())
        .patch(
          `/campaigns/${campaign.id}/maps/${map.id}/pins/${pin.id}/position`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ xNormalized: 1.5, yNormalized: 0.1 });
      expect(outOfRangeRes.status).toBe(400);
    });
  });

  describe('visibility leak prevention', () => {
    it('hides a gm_only map from a player but shows it to the GM/owner', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'GM Only Map Campaign',
      );
      const player = await addMember(
        campaign.id,
        'gm-only-map-player',
        'player',
      );
      const map = await createMap(token, campaign.id, {
        visibility: 'gm_only',
      });

      const playerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(playerGet.status).toBe(404);

      const playerList = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<MapSummary[]>(playerList).some((m) => m.id === map.id)).toBe(
        false,
      );

      const ownerGet = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(ownerGet.status).toBe(200);
    });

    it('hides pins on a gm_only layer from a player even though the map is public', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'GM Only Layer Campaign',
      );
      const player = await addMember(
        campaign.id,
        'gm-only-layer-player',
        'player',
      );
      const map = await createMap(token, campaign.id);
      const layer = await createLayer(token, campaign.id, map.id, {
        visibility: 'gm_only',
      });
      const pin = await createPin(token, campaign.id, map.id, {
        layerId: layer.id,
      });

      const playerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<MapDetail>(playerRes).pins.some((p) => p.id === pin.id)).toBe(
        false,
      );

      const ownerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<MapDetail>(ownerRes).pins.some((p) => p.id === pin.id)).toBe(
        true,
      );
    });

    it('does not leak a gm_only entity through a public pin on a public map with no layer', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Public Pin Gm Entity Leak Campaign',
      );
      const player = await addMember(campaign.id, 'leak-player', 'player');
      const map = await createMap(token, campaign.id);
      const secretEntity = await createEntity(token, campaign.id, {
        name: 'The Hidden Lich',
        visibility: 'gm_only',
      });
      const pin = await createPin(token, campaign.id, map.id, {
        locationEntityId: secretEntity.id,
      });

      const playerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${player.token}`);
      expect(body<MapDetail>(playerRes).pins.some((p) => p.id === pin.id)).toBe(
        false,
      );

      const ownerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<MapDetail>(ownerRes).pins.some((p) => p.id === pin.id)).toBe(
        true,
      );
    });

    it('hides a pin whose linked entity has been soft-deleted', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Pin Deleted Entity Campaign',
      );
      const map = await createMap(token, campaign.id);
      const entity = await createEntity(token, campaign.id);
      const pin = await createPin(token, campaign.id, map.id, {
        locationEntityId: entity.id,
      });

      await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}/entities/${entity.id}`)
        .set('Authorization', `Bearer ${token}`);

      const ownerRes = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(body<MapDetail>(ownerRes).pins.some((p) => p.id === pin.id)).toBe(
        false,
      );
    });
  });

  describe('map image attachment gate', () => {
    it('rejects a not-ready attachment as a map image', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Map Image Not Ready Campaign',
      );
      const map = await createMap(token, campaign.id);

      const presignRes = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/attachments/presign`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          filename: 'x.png',
          declaredMimeType: 'image/png',
          sizeBytes: 10,
        });
      const { attachmentId } = body<PresignedUploadResponse>(presignRes);

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ imageAttachmentId: attachmentId });
      expect(res.status).toBe(403);
    });

    it('rejects a map image attachment id from another campaign', async () => {
      const { token: tokenA, campaign: campaignA } =
        await createOwnerAndCampaign('Map Image Cross A');
      const { token: tokenB, campaign: campaignB } =
        await createOwnerAndCampaign('Map Image Cross B');
      const map = await createMap(tokenA, campaignA.id);
      const attachmentId = await uploadReadyImage(tokenB, campaignB.id);

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaignA.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ imageAttachmentId: attachmentId });
      expect(res.status).toBe(404);
    });

    it('sets a ready image attachment as the map image, exposing its url/width/height', async () => {
      const { token, campaign } = await createOwnerAndCampaign(
        'Map Image Ready Campaign',
      );
      const map = await createMap(token, campaign.id);
      const attachmentId = await uploadReadyImage(token, campaign.id);

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}/maps/${map.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ imageAttachmentId: attachmentId });
      expect(res.status).toBe(200);
      const updated = body<MapDetail>(res);
      expect(updated.imageUrl).toBeTruthy();
      expect(updated.imageWidth).toBe(800);
      expect(updated.imageHeight).toBe(600);
    });
  });
});
