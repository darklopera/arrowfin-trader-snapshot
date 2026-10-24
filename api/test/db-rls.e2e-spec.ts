import { Client } from 'pg';

/**
 * The database ALONE (no NestJS, no application code) must isolate tenants.
 * These tests talk to Postgres as the real application role.
 */
describe('Row Level Security (database-level tenant isolation)', () => {
  let app: Client;
  let admin: Client;

  beforeAll(async () => {
    app = new Client({ connectionString: process.env.DATABASE_URL });
    admin = new Client({ connectionString: process.env.ADMIN_DATABASE_URL });
    await app.connect();
    await admin.connect();
  });
  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  it('seed is loaded (admin sees all 687 fills)', async () => {
    const r = await admin.query("SELECT count(*)::int AS n FROM fills WHERE id NOT LIKE 'FIL-DEV-%'");
    expect(r.rows[0].n).toBe(687);
  });

  it('FAILS CLOSED: with no tenant set, the app role sees ZERO rows (forgotten WHERE cannot leak)', async () => {
    for (const t of ['brokers', 'traders', 'accounts', 'fills']) {
      const r = await app.query(`SELECT count(*)::int AS n FROM ${t}`);
      expect(r.rows[0].n).toBe(0);
    }
  });

  it('with a tenant set, a query WITHOUT any broker filter only returns that tenant', async () => {
    await app.query('BEGIN');
    await app.query("SELECT set_config('app.broker_id', 'BRK-SMPT', true)");
    const r = await app.query('SELECT DISTINCT broker_id FROM fills');
    await app.query('COMMIT');
    expect(r.rows.map((x) => x.broker_id)).toEqual(['BRK-SMPT']);
  });

  it('the tenant setting does not survive the transaction (pooled connections cannot leak a tenant)', async () => {
    await app.query('BEGIN');
    await app.query("SELECT set_config('app.broker_id', 'BRK-SMPT', true)");
    await app.query('COMMIT');
    const r = await app.query('SELECT count(*)::int AS n FROM fills');
    expect(r.rows[0].n).toBe(0);
  });

  it('the app role is read-only', async () => {
    await expect(app.query("UPDATE fills SET quantity = 1 WHERE id = 'FIL-500001'")).rejects.toThrow(/permission denied/);
    await expect(app.query('DELETE FROM fills')).rejects.toThrow(/permission denied/);
  });

  it('a fill cannot reference an account of another broker (composite FK)', async () => {
    await expect(
      admin.query(`INSERT INTO fills (id, broker_id, account_id, instrument_symbol, side, quantity, price, filled_at, order_id, liquidity, commission_usd)
                   VALUES ('FIL-X', 'BRK-SMPT', 'ACC-1001', 'MES', 'BUY', 1, 5000, now(), 'ORD-X', 'taker', 0)`),
    ).rejects.toThrow(/foreign key/);
  });

  it('GUARDRAIL: every table that carries broker_id (or is brokers) has RLS enabled AND forced', async () => {
    // Fails the build when someone adds a tenant-owned table and forgets its policy.
    const r = await admin.query(`
      SELECT c.relname, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND (c.relname = 'brokers' OR EXISTS (
              SELECT 1 FROM information_schema.columns col
              WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'broker_id'))
      ORDER BY 1`);
    expect(r.rows.map((x) => x.relname)).toEqual(['accounts', 'brokers', 'fills', 'traders']);
    for (const t of r.rows) {
      expect({ table: t.relname, enabled: t.enabled, forced: t.forced, hasPolicy: t.policies > 0 })
        .toEqual({ table: t.relname, enabled: true, forced: true, hasPolicy: true });
    }
  });

  it('the app role is not a superuser, not the owner, and cannot bypass RLS', async () => {
    const r = await admin.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'arrowfin_app'");
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const o = await admin.query("SELECT tableowner FROM pg_tables WHERE tablename = 'fills'");
    expect(o.rows[0].tableowner).not.toBe('arrowfin_app');
  });

  it('PII columns from the seed were never stored', async () => {
    const r = await admin.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name IN ('traders','brokers')`,
    );
    const cols = r.rows.map((x) => x.column_name);
    for (const banned of ['email', 'phone', 'dob', 'ssn_last4', 'address_line1', 'notes', 'audit_notes', 'first_name', 'last_name', 'api_key_hash']) {
      expect(cols).not.toContain(banned);
    }
  });
});
