import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, like } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { campaignMembers, campaigns, users } from '../src/database/schema';
import { createVerifiedUser, uniqueEmail } from './helpers/test-users';

const TEST_EMAIL_DOMAIN = 'transaction-atomicity-test.local';

/**
 * Milestone 14 Phase 12 — "verify the transactional-per-invocation behavior
 * drizzle-orm already provides (a partial failure mid-batch rolls back that
 * batch) actually holds under a forced-failure test." `campaigns.service.ts`
 * (and several other services) rely on `db.transaction(async (tx) => {...})`
 * to keep multi-step writes atomic — this proves that guarantee against a
 * *real* Postgres constraint violation (the `campaignMembers`
 * `(campaignId, userId)` unique constraint), not a synthetic `throw`, so
 * it's the database's own rollback semantics being exercised through
 * drizzle's transaction wrapper that's under test, not just a JS try/catch
 * masking a partial write.
 */
describe('Transaction atomicity (e2e)', () => {
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
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `%@${TEST_EMAIL_DOMAIN}`));
    await app.close();
  }, 15000);

  it('rolls back an earlier insert when a later insert in the same transaction fails', async () => {
    const owner = await createVerifiedUser(
      db,
      passwords,
      'forced-failure-password-9!',
      uniqueEmail(TEST_EMAIL_DOMAIN, 'owner'),
    );

    // A pre-existing membership row the transaction below will collide with.
    const [existingCampaign] = await db
      .insert(campaigns)
      .values({
        ownerUserId: owner.id,
        name: 'Pre-existing campaign',
        slug: `pre-existing-${owner.id}`,
        status: 'active',
      })
      .returning({ id: campaigns.id });
    if (!existingCampaign) throw new Error('setup failed');

    await db.insert(campaignMembers).values({
      campaignId: existingCampaign.id,
      userId: owner.id,
      role: 'owner',
    });

    let newCampaignId: string | undefined;

    await expect(
      db.transaction(async (tx) => {
        const [newCampaign] = await tx
          .insert(campaigns)
          .values({
            ownerUserId: owner.id,
            name: 'Should not survive rollback',
            slug: `should-not-survive-${owner.id}`,
            status: 'active',
          })
          .returning({ id: campaigns.id });
        if (!newCampaign) throw new Error('setup failed');
        newCampaignId = newCampaign.id;

        // Real unique-constraint violation — same (campaignId, userId) pair
        // already inserted above, just for a *different* campaign row than
        // the one this transaction is trying to create.
        await tx.insert(campaignMembers).values({
          campaignId: existingCampaign.id,
          userId: owner.id,
          role: 'gm',
        });
      }),
    ).rejects.toThrow();

    expect(newCampaignId).toBeDefined();
    const [survived] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, newCampaignId!));
    expect(survived).toBeUndefined();

    // Cleanup: only the pre-existing campaign actually persisted (the
    // transaction's own insert rolled back, which is the entire point).
    await db.delete(campaigns).where(eq(campaigns.id, existingCampaign.id));
  });
});
