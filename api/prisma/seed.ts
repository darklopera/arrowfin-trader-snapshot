import { join } from 'node:path';
import { createPrismaClient } from '../src/shared/prisma.service';
import { seedDatabase } from './seed-lib';

async function main() {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL (privileged connection) is required to seed');
  const prisma = createPrismaClient(url);
  try {
    const res = await seedDatabase(prisma, process.env.DATASET_DIR ?? join(__dirname, '..', '..', 'dataset'));
    console.log('seeded', res);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
