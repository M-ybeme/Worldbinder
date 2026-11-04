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

const TEST_EMAIL_DOMAIN = 'maps-audience-integration-test.local';

function body<T>(res: request.Response): T {
  return res.body as T;
}

/**
 * `GET /campaigns/:id/maps/:mapId?audience=players` — the player view of a
 * map, for At the Table. Whoever asks (even the owner), the response must
 * be exactly what a player gets: the server, not the page, leaves GM-only
 * material out.
 */
describe('Maps — player audience (e2e)', () => {
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

  async function addUser(
    label: string,
  ): Promise<{ id: string; token: string }> {
    const password = 'audience-password-123';
    const user = await createVerifiedUser(
      db,
      passwords,
      password,
      uniqueEmail(TEST_EMAIL_DOMAIN, label),
    );
    return { id: user.id, token: await loginAs(user.email, password) };
  }

  async function post<T>(
    token: string,
    path: string,
    data: object,
  ): Promise<T> {
    const res = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(data);
    expect(res.status).toBeLessThan(300);
    return body<T>(res);
  }

  function getMap(token: string, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);
  }

  /** A public map with every kind of GM-only material on it, and the
   * owner, a GM, an editor with secret access, and a player. */
  async function seed() {
    const owner = await addUser('owner');
    const campaign = await post<CampaignDetail>(owner.token, '/campaigns', {
      name: 'Audience Campaign',
    });
    const c = campaign.id;
    const members: Record<string, string> = {};
    for (const [label, role, secret] of [
      ['gm', 'gm', false],
      ['editor', 'editor', true],
      ['player', 'player', false],
    ] as [string, CampaignRole, boolean][]) {
      const user = await addUser(label);
      await db.insert(campaignMembers).values({
        campaignId: c,
        userId: user.id,
        role,
        editorSecretAccess: secret,
      });
      members[label] = user.token;
    }

    const entity = (name: string, visibility: 'public' | 'gm_only') =>
      post<EntityDetail>(owner.token, `/campaigns/${c}/entities`, {
        entityType: 'location',
        name,
        summary: `${name} summary`,
        visibility,
      });
    const town = await entity('Blackwall', 'public');
    const court = await entity('The Pale Court', 'gm_only');

    const map = await post<MapSummary>(owner.token, `/campaigns/${c}/maps`, {
      name: 'The Northern March',
    });
    const base = `/campaigns/${c}/maps/${map.id}`;
    const towns = await post<MapLayerSummary>(owner.token, `${base}/layers`, {
      name: 'Settlements',
    });
    const secrets = await post<MapLayerSummary>(owner.token, `${base}/layers`, {
      name: 'GM secrets',
      visibility: 'gm_only',
    });
    const pin = (data: object) =>
      post<MapPinSummary>(owner.token, `${base}/pins`, {
        xNormalized: 0.5,
        yNormalized: 0.5,
        ...data,
      });
    await pin({ locationEntityId: town.id, layerId: towns.id });
    await pin({ label: 'Waystone' });
    await pin({ label: 'Secret door', visibility: 'gm_only' });
    await pin({ label: 'Hidden camp', layerId: secrets.id });
    await pin({ locationEntityId: court.id });

    const hiddenMap = await post<MapSummary>(
      owner.token,
      `/campaigns/${c}/maps`,
      { name: 'Gatehouse Tunnels', visibility: 'gm_only' },
    );

    return {
      owner: owner.token,
      ...members,
      path: base,
      hiddenPath: `/campaigns/${c}/maps/${hiddenMap.id}`,
    } as Record<
      'owner' | 'gm' | 'editor' | 'player' | 'path' | 'hiddenPath',
      string
    >;
  }

  const pinNames = (detail: MapDetail) =>
    detail.pins.map((p) => p.label ?? p.locationEntityName).sort();

  it('gives everyone — owner, GM, editor with secret access, player — exactly the player view', async () => {
    const world = await seed();

    const full = await getMap(world.owner, world.path);
    expect(pinNames(body<MapDetail>(full))).toEqual([
      'Blackwall',
      'Hidden camp',
      'Secret door',
      'The Pale Court',
      'Waystone',
    ]);

    const asPlayer = body<MapDetail>(await getMap(world.player, world.path));
    expect(pinNames(asPlayer)).toEqual(['Blackwall', 'Waystone']);
    expect(asPlayer.layers.map((l) => l.name)).toEqual(['Settlements']);

    for (const who of ['owner', 'gm', 'editor', 'player'] as const) {
      const res = await getMap(world[who], `${world.path}?audience=players`);
      expect(res.status).toBe(200);
      // Byte-for-byte the player's own view, apart from per-request image URLs.
      expect(body<MapDetail>(res)).toEqual(asPlayer);
      const text = JSON.stringify(res.body);
      for (const secret of [
        'Secret door',
        'Hidden camp',
        'The Pale Court',
        'GM secrets',
        'gm_only',
      ]) {
        expect(text).not.toContain(secret);
      }
    }
  });

  it('has no player view of a GM-only map, and rejects unknown audiences', async () => {
    const world = await seed();
    expect((await getMap(world.owner, world.hiddenPath)).status).toBe(200);
    expect(
      (await getMap(world.owner, `${world.hiddenPath}?audience=players`))
        .status,
    ).toBe(404);
    expect(
      (await getMap(world.player, `${world.hiddenPath}?audience=players`))
        .status,
    ).toBe(404);
    expect(
      (await getMap(world.owner, `${world.path}?audience=gm`)).status,
    ).toBe(400);
  });
});
