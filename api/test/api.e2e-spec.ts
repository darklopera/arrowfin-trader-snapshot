import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanDevFills, createApp, forge, login, postFill } from './helpers';

// Expected values come from scripts/oracle.py: an INDEPENDENT implementation run on the raw CSVs.
const expected: Record<string, any> = JSON.parse(readFileSync(join(__dirname, 'fixtures/expected-snapshots.json'), 'utf8'));
const ACCOUNT_OWNER: Record<string, [string, string]> = {
  'ACC-1001': ['BRK-ARWP', 'T-001'], 'ACC-1002': ['BRK-ARWP', 'T-001'], 'ACC-1003': ['BRK-ARWP', 'T-002'],
  'ACC-1004': ['BRK-ARWP', 'T-003'], 'ACC-1005': ['BRK-ARWP', 'T-004'], 'ACC-1006': ['BRK-SMPT', 'T-005'],
  'ACC-1007': ['BRK-SMPT', 'T-005'], 'ACC-1008': ['BRK-SMPT', 'T-006'], 'ACC-1009': ['BRK-SMPT', 'T-007'],
  'ACC-1010': ['BRK-SMPT', 'T-008'], 'ACC-1011': ['BRK-MRDN', 'T-009'], 'ACC-1012': ['BRK-MRDN', 'T-009'],
  'ACC-1013': ['BRK-MRDN', 'T-010'], 'ACC-1014': ['BRK-MRDN', 'T-011'], 'ACC-1015': ['BRK-MRDN', 'T-012'],
  'ACC-1016': ['BRK-SMPT', 'T-013'], 'ACC-1017': ['BRK-ARWP', 'T-014'], 'ACC-1018': ['BRK-ARWP', 'T-002'],
};
const BANNED_KEYS = ['balance', 'email', 'phone', 'dob', 'ssn', 'address', 'notes', 'firstname', 'lastname', 'accountnumber', 'apikey'];
const keysDeep = (o: any): string[] => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [k, ...keysDeep(v)]) : []);

describe('REST API', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => { await cleanDevFills(); ({ app, url } = await createApp()); });
  afterAll(async () => { await app.close(); await cleanDevFills(); });
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('authentication', () => {
    const snap = (t?: string) => request(url).get('/v1/me/snapshot').set(t ? auth(t) : {});
    it('health is public', () => request(url).get('/v1/health').expect(200));
    it('responses are never cacheable (financial data)', async () => {
      const res = await request(url).get('/v1/health').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });
    it('no token -> 401', () => snap().expect(401));
    it('garbage token -> 401', () => snap('abc.def.ghi').expect(401));
    it('alg=none token -> 401 (algorithm is pinned)', () => snap(forge.alg_none()).expect(401));
    it('token signed with another secret -> 401', () => snap(forge.ok({}, {}, 'some-other-secret-some-other-secret-xx')).expect(401));
    it('expired token -> 401', () => snap(forge.ok({ expiresIn: -60 })).expect(401));
    it('token for another audience -> 401', () => snap(forge.ok({ audience: 'billing-api' })).expect(401));
    it('token without exp -> 401', () => snap(forge.ok({ expiresIn: null })).expect(401));
    it('malformed tenant claim -> 401 even when correctly signed', () => snap(forge.ok({}, { bid: "BRK-X' OR 1=1" })).expect(401));
    it('a signed token for a trader that is NOT in that broker sees nothing (RLS + scoped WHERE)', async () => {
      const t = forge.ok({ subject: 'T-001' }); // T-001 is a BRK-ARWP trader, claim says BRK-SMPT
      const res = await request(url).get('/v1/me/accounts').set(auth(t)).expect(200);
      expect(res.body).toEqual([]);
      await snap(t).expect(404);
    });
  });

  describe('tenant isolation', () => {
    const asTrader = async (b: string, t: string) => auth(await login(url, b, t));
    it("lists only the caller's own accounts", async () => {
      const res = await request(url).get('/v1/me/accounts').set(await asTrader('BRK-SMPT', 'T-005')).expect(200);
      expect(res.body.map((a: any) => a.id)).toEqual(['ACC-1006', 'ACC-1007']);
    });
    it('CROSS-TENANT: a Summit trader asking for a Retail account -> 404', async () => {
      await request(url).get('/v1/me/snapshot?accountId=ACC-1001').set(await asTrader('BRK-SMPT', 'T-005')).expect(404);
    });
    it('CROSS-TENANT, reverse direction -> 404', async () => {
      await request(url).get('/v1/me/snapshot?accountId=ACC-1006').set(await asTrader('BRK-ARWP', 'T-001')).expect(404);
    });
    it('SAME TENANT, other trader (horizontal IDOR) -> 404', async () => {
      await request(url).get('/v1/me/snapshot?accountId=ACC-1008').set(await asTrader('BRK-SMPT', 'T-005')).expect(404);
    });
    it('foreign and non-existent accounts are indistinguishable (no existence oracle)', async () => {
      const h = await asTrader('BRK-SMPT', 'T-005');
      const foreign = await request(url).get('/v1/me/snapshot?accountId=ACC-1001').set(h);
      const missing = await request(url).get('/v1/me/snapshot?accountId=ACC-9999').set(h);
      expect(foreign.status).toBe(missing.status);
      expect(foreign.body).toEqual(missing.body);
    });
    it('a broker/trader smuggled in the query string is rejected, not honoured', async () => {
      await request(url).get('/v1/me/snapshot?brokerId=BRK-ARWP&traderId=T-001').set(await asTrader('BRK-SMPT', 'T-005')).expect(400);
    });
    it('malformed accountId (SQLi / log-injection / traversal attempts) -> 400', async () => {
      const h = await asTrader('BRK-SMPT', 'T-005');
      for (const bad of ["ACC-1006'; DROP TABLE fills;--", 'ACC-1006\r\nFAKE LOG LINE', '../../etc/passwd']) {
        await request(url).get(`/v1/me/snapshot?accountId=${encodeURIComponent(bad)}`).set(h).expect(400);
      }
    });
  });

  describe('snapshot correctness vs the independent Python oracle (all 18 accounts)', () => {
    for (const [accountId, [brokerId, traderId]] of Object.entries(ACCOUNT_OWNER)) {
      it(accountId, async () => {
        const token = await login(url, brokerId, traderId);
        const { body: s } = await request(url).get(`/v1/me/snapshot?accountId=${accountId}`).set(auth(token)).expect(200);
        const e = expected[accountId];
        expect(Object.fromEntries(s.positions.map((p: any) => [p.symbol, p.netQty]))).toEqual(e.positions);
        expect(s.pnl.realizedGrossUsd).toBeCloseTo(e.realizedGross, 2);
        expect(s.pnl.commissionsUsd).toBeCloseTo(e.commissions, 2);
        expect(s.pnl.unrealizedUsd).toBeCloseTo(e.unrealized, 2);
        expect(s.risk.grossNotionalUsd).toBeCloseTo(e.gross, 2);
        expect(s.risk.score).toBeCloseTo(e.score, 1);
        expect(s.activity).toEqual({ fillsToday: e.fillsToday, ordersToday: e.ordersToday });
        expect(s.version).toBe(e.fills);
        expect(s.session.startedAt).toBe('2026-08-24T22:00:00.000Z');
      });
    }
  });

  describe('edge cases the dataset warns about', () => {
    const get = async (b: string, t: string, a: string) =>
      request(url).get(`/v1/me/snapshot?accountId=${a}`).set(auth(await login(url, b, t))).expect(200);
    it('account with NO fills -> valid empty snapshot (ACC-1014)', async () => {
      const { body } = await get('BRK-MRDN', 'T-011', 'ACC-1014');
      expect(body.positions).toEqual([]);
      expect(body.risk.score).toBe(0);
    });
    it('zero balance + open position -> risk 100, not NaN/Infinity (ACC-1013)', async () => {
      const { body } = await get('BRK-MRDN', 'T-010', 'ACC-1013');
      expect(body.positions).toHaveLength(1);
      expect(body.risk).toMatchObject({ score: 100, level: 'high' });
    });
    it('closed account is readable and reports its status (ACC-1012)', async () => {
      const { body } = await get('BRK-MRDN', 'T-009', 'ACC-1012');
      expect(body.account.status).toBe('closed');
    });
    it('default account for a trader with several = first ACTIVE one', async () => {
      const token = await login(url, 'BRK-SMPT', 'T-005');
      const { body } = await request(url).get('/v1/me/snapshot').set(auth(token)).expect(200);
      expect(body.account.id).toBe('ACC-1006');
    });
  });

  describe('data minimisation of the response', () => {
    it('never contains balance, names, contact data or the full account number', async () => {
      const token = await login(url, 'BRK-SMPT', 'T-005');
      const { body } = await request(url).get('/v1/me/snapshot').set(auth(token)).expect(200);
      const keys = keysDeep(body).map((k) => k.toLowerCase());
      for (const banned of BANNED_KEYS) expect(keys).not.toContain(banned);
      expect(JSON.stringify(body)).not.toContain('SMT-200001');
      expect(body.account.accountNumberMasked).toBe('••••0001');
    });
  });

  describe('dev fill simulator', () => {
    const fill = { account_id: 'ACC-1006', instrument_symbol: 'MES', side: 'BUY', quantity: 1, price: 5643.25, commission_usd: 0.7 };
    it('without the dev key -> 401', () => postFill(url, fill, null).expect(401));
    it('with a wrong dev key -> 401', () => postFill(url, fill, 'nope').expect(401));
    it('a user JWT is not a dev key -> 401', async () => {
      const token = await login(url, 'BRK-SMPT', 'T-005');
      await request(url).post('/dev/fills').set(auth(token)).send(fill).expect(401);
    });
    it('validates the body (bad side, absurd quantity, unknown fields) and rejects unknown accounts', async () => {
      await postFill(url, { ...fill, side: 'HODL' }).expect(400);
      await postFill(url, { ...fill, quantity: 100000 }).expect(400);
      await postFill(url, { ...fill, broker_id: 'BRK-ARWP' }).expect(400);
      await postFill(url, { ...fill, account_id: 'ACC-9999' }).expect(404);
    });
  });
});
