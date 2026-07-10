import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { apiEnvSchema, loadEnv } from '@worldbinder/config';

async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: '../../infrastructure/migrations' });
  console.log('Migrations complete.');

  await pool.end();
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
