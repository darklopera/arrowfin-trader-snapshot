/**
 * Dev Postgres WITHOUT Docker (embedded-postgres downloads a real Postgres
 * binary). With Docker, prefer `docker compose up -d db` instead.
 *   npm run db:embedded   -> starts on :54329, creates DB + roles, migrates, seeds
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEmbedded } from './embedded';
import { Client } from 'pg';
import { createPrismaClient } from '../src/shared/prisma.service';
import { seedDatabase } from '../prisma/seed-lib';
import { applyMigrations } from './apply-migrations';

const PORT = 54329;
const dir = join(__dirname, '..', '.pgdata');

async function main() {
  const fresh = !existsSync(join(dir, 'PG_VERSION'));
  const pg = await createEmbedded({ databaseDir: dir, user: 'arrowfin_owner', password: 'owner_dev_password', port: PORT, persistent: true });
  if (fresh) await pg.initialise();
  await pg.start();

  if (fresh) {
    await pg.createDatabase('arrowfin');
    const admin = new Client({ connectionString: `postgresql://arrowfin_owner:owner_dev_password@localhost:${PORT}/arrowfin` });
    await admin.connect();
    await admin.query(readFileSync(join(__dirname, '..', 'db', 'init-roles.sql'), 'utf8'));
    await admin.end();
    const adminUrl = `postgresql://arrowfin_owner:owner_dev_password@localhost:${PORT}/arrowfin`;
    await applyMigrations(adminUrl);
    const prisma = createPrismaClient(adminUrl);
    console.log('seeded', await seedDatabase(prisma, join(__dirname, '..', '..', 'dataset')));
    await prisma.$disconnect();
  }
  console.log(`Postgres ready on :${PORT}. Ctrl+C to stop.`);
  const stop = async () => { await pg.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => undefined, 1 << 30);
}
main().catch((e) => { console.error(e); process.exit(1); });
