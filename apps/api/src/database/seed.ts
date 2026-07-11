import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { userCredentials, users } from './schema';

const DEMO_EMAIL = 'gm@worldbinder.local';
const DEMO_PASSWORD = 'worldbinder-demo';

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding local development data...');

  const inserted = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      displayName: 'Demo Game Master',
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  const user =
    inserted[0] ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, DEMO_EMAIL))
    )[0];

  if (!user) {
    throw new Error('Failed to resolve seeded demo user id.');
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  await db
    .insert(userCredentials)
    .values({ userId: user.id, passwordHash })
    .onConflictDoNothing({ target: userCredentials.userId });

  console.log(`Seed complete. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
