import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { cleanDevFills, collect, connect, createApp, forge, login, postFill } from './helpers';

const fill = (account_id: string, over: object = {}) => ({
  account_id, instrument_symbol: 'MES', side: 'BUY', quantity: 1, price: 5643.25, commission_usd: 0.7, ...over,
});

describe('WebSocket channel', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];
  const open = async (token?: string) => { const s = await connect(url, token); sockets.push(s); return s; };

  beforeAll(async () => { await cleanDevFills(); ({ app, url } = await createApp()); });
  afterEach(() => { sockets.splice(0).forEach((s) => s.close()); });
  afterAll(async () => { await app.close(); await cleanDevFills(); });

  describe('authentication happens at connection time', () => {
    it('no token -> connection refused', async () => { await expect(connect(url)).rejects.toThrow('unauthorized'); });
    it('garbage token -> refused', async () => { await expect(connect(url, 'garbage')).rejects.toThrow('unauthorized'); });
    it('alg=none token -> refused', async () => { await expect(connect(url, forge.alg_none())).rejects.toThrow('unauthorized'); });
    it('expired token -> refused', async () => { await expect(connect(url, forge.ok({ expiresIn: -10 }))).rejects.toThrow('unauthorized'); });
    it('a token in the URL query string is NOT accepted (it would leak into access logs)', async () => {
      const token = await login(url, 'BRK-SMPT', 'T-005');
      const s = io(`${url}?token=${token}`, { transports: ['websocket'], reconnection: false });
      await expect(new Promise<void>((res, rej) => { s.on('connect', () => res()); s.on('connect_error', rej); })).rejects.toThrow('unauthorized');
      s.close();
    });
    it('a valid token connects', async () => {
      const s = await open(await login(url, 'BRK-SMPT', 'T-005'));
      expect(s.connected).toBe(true);
    });
  });

  describe('tenant and trader scoping', () => {
    it('delivers a fill to the owner, and ONLY to the owner', async () => {
      const owner = await open(await login(url, 'BRK-SMPT', 'T-005'));       // owns ACC-1006
      const sameBroker = await open(await login(url, 'BRK-SMPT', 'T-006'));   // same tenant, other trader
      const otherBroker = await open(await login(url, 'BRK-ARWP', 'T-001'));  // another tenant
      const wait = [collect(owner, 800), collect(sameBroker, 800), collect(otherBroker, 800)];

      await postFill(url, fill('ACC-1006')).expect(202);
      const [ownerGot, sameBrokerGot, otherBrokerGot] = await Promise.all(wait);

      expect(ownerGot).toHaveLength(1);
      expect(ownerGot[0].accountId).toBe('ACC-1006');
      expect(sameBrokerGot).toEqual([]);  // cross-TRADER inside one tenant
      expect(otherBrokerGot).toEqual([]); // cross-TENANT: the worst outcome in the exercise
    });

    it("a trader with two accounts receives both streams, never anyone else's", async () => {
      const t005 = await open(await login(url, 'BRK-SMPT', 'T-005')); // ACC-1006 + ACC-1007
      const t001 = await open(await login(url, 'BRK-ARWP', 'T-001'));
      const w = [collect(t005, 800), collect(t001, 800)];
      await postFill(url, fill('ACC-1007')).expect(202);
      await postFill(url, fill('ACC-1001')).expect(202);
      const [g005, g001] = await Promise.all(w);
      expect(g005.map((e) => e.accountId)).toEqual(['ACC-1007']);
      expect(g001.map((e) => e.accountId)).toEqual(['ACC-1001']);
    });

    it('a client cannot join a room by asking: there are no inbound handlers', async () => {
      const attacker = await open(await login(url, 'BRK-SMPT', 'T-006'));
      const w = collect(attacker, 800);
      for (const evt of ['join', 'subscribe', 'joinRoom', 'subscribe:account']) {
        attacker.emit(evt, { room: 'acct:BRK-SMPT:ACC-1006', accountId: 'ACC-1006', brokerId: 'BRK-SMPT' });
        attacker.emit(evt, 'acct:BRK-SMPT:ACC-1006');
      }
      await postFill(url, fill('ACC-1006')).expect(202);
      expect(await w).toEqual([]);
    });
  });

  describe('payload', () => {
    it('is the same minimal snapshot as REST, with a monotonically increasing version', async () => {
      const token = await login(url, 'BRK-SMPT', 'T-005');
      const before = (await request(url).get('/v1/me/snapshot?accountId=ACC-1006').set({ Authorization: `Bearer ${token}` })).body;
      const s = await open(token);
      const w = collect(s, 800);
      await postFill(url, fill('ACC-1006')).expect(202);
      const [evt] = await w;

      expect(evt.version).toBe(before.version + 1);
      expect(evt.lastFill).toMatchObject({ symbol: 'MES', side: 'BUY', quantity: 1, price: 5643.25 });
      const text = JSON.stringify(evt);
      for (const banned of ['balance', 'email', 'phone', 'ssn', 'SMT-200001', 'notes']) expect(text).not.toContain(banned);
      const mes = (p: any) => p.positions.find((x: any) => x.symbol === 'MES').netQty;
      expect(mes(evt.snapshot)).toBe(mes(before) + 1);
    });
  });

  describe('socket lifetime is bounded by token lifetime', () => {
    it('the server disconnects the socket when the JWT expires', async () => {
      const s = await open(forge.ok({ expiresIn: 2 }));
      const reason = await new Promise<string>((res) => s.on('disconnect', res));
      expect(reason).toBe('io server disconnect');
    }, 15000);
  });
});
