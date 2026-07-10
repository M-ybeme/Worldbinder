import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { users } from './schema';

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding local development data...');
  await db
    .insert(users)
    .values({
      email: 'gm@worldbinder.local',
      displayName: 'Demo Game Master',
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: users.email });
  console.log('Seed complete.');

  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
