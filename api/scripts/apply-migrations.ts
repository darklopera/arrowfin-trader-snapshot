/**
 * Minimal migration runner for the embedded/test Postgres: executes the SQL in
 * prisma/migrations in order. In a real environment use `prisma migrate deploy`
 * (same SQL files). Not idempotent on purpose: run it on a fresh database.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export async function applyMigrations(adminUrl: string) {
  const root = join(__dirname, '..', 'prisma', 'migrations');
  const dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    for (const dir of dirs) await client.query(readFileSync(join(root, dir, 'migration.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}
