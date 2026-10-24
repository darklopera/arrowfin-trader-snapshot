import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadConfig } from '../src/config/env';

export const DEV_KEY = 'test-dev-key';
const SECRET = 'test-secret-test-secret-test-secret-0123';

export async function createApp(): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, loadConfig()); // the REAL production wiring, not a test double
  await app.listen(0);
  const url = await app.getUrl();
  return { app, url: url.replace('[::1]', 'localhost') };
}

export async function login(url: string, brokerId: string, traderId: string): Promise<string> {
  const res = await request(url).post('/dev/auth/login').send({ brokerId, traderId }).expect(201);
  return res.body.token;
}

/** key === null sends NO x-dev-key header (undefined would fall back to the default). */
export const postFill = (url: string, body: object, key: string | null = DEV_KEY) => {
  const r = request(url).post('/dev/fills');
  if (key) r.set('x-dev-key', key);
  return r.send(body);
};

export function connect(url: string, token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { transports: ['websocket'], auth: token === undefined ? {} : { token }, reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => { s.close(); reject(e); });
  });
}

export const collect = (s: Socket, ms: number) =>
  new Promise<any[]>((resolve) => {
    const got: any[] = [];
    s.on('snapshot:update', (e) => got.push(e));
    setTimeout(() => resolve(got), ms);
  });

/** Forge tokens the way an attacker would. */
export const forge = {
  /** Pass `expiresIn: null` to build a token with NO exp claim. */
  ok: (opts: Omit<jwt.SignOptions, 'expiresIn'> & { expiresIn?: number | null } = {}, claims: object = {}, secret = SECRET) => {
    const { expiresIn = 600, ...rest } = opts;
    return jwt.sign({ bid: 'BRK-SMPT', ...claims }, secret, {
      algorithm: 'HS256', subject: 'T-005', issuer: 'arrowfin-auth', audience: 'arrowfin-snapshot-api',
      ...(expiresIn === null ? {} : { expiresIn }), ...rest,
    });
  },
  alg_none: () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'T-005', bid: 'BRK-SMPT', iss: 'arrowfin-auth', aud: 'arrowfin-snapshot-api', exp: Math.floor(Date.now() / 1000) + 600 })}.`;
  },
};

/** Fills created by the simulator are removed so spec files cannot influence each other. */
export async function cleanDevFills() {
  const { Client } = await import('pg');
  const c = new Client({ connectionString: process.env.ADMIN_DATABASE_URL });
  await c.connect();
  await c.query("DELETE FROM fills WHERE id LIKE 'FIL-DEV-%'");
  await c.end();
}
