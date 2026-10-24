import { mkdtempSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { createEmbedded } from '../scripts/embedded';
import { applyMigrations } from '../scripts/apply-migrations';
import { createPrismaClient } from '../src/shared/prisma.service';
import { seedDatabase } from '../prisma/seed-lib';

/**
 * Starts a REAL Postgres (not a mock) so RLS is exercised for real: the e2e
 * tests are only meaningful if the database enforces tenant isolation.
 */
export default async function globalSetup() {
  const port = 55000 + Math.floor(Math.random() * 500);
  const dir = mkdtempSync(join(tmpdir(), 'arrowfin-pg-'));
  const pg = await createEmbedded({ databaseDir: dir, user: 'owner', password: 'owner_pw', port, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('arrowfin_test');

  const adminUrl = `postgresql://owner:owner_pw@localhost:${port}/arrowfin_test`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(readFileSync(join(__dirname, '..', 'db', 'init-roles.sql'), 'utf8'));
  await admin.end();
  await applyMigrations(adminUrl);

  const prisma = createPrismaClient(adminUrl);
  await seedDatabase(prisma, join(__dirname, '..', '..', 'dataset'));
  await prisma.$disconnect();

  process.env.ADMIN_DATABASE_URL = adminUrl;
  process.env.DATABASE_URL = `postgresql://arrowfin_app:app_dev_password@localhost:${port}/arrowfin_test`;
  (globalThis as any).__PG__ = pg;
}
