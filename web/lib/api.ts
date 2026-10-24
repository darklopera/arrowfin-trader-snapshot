import type { AccountSummary, DemoTrader, Snapshot } from './types';
import { Session, clearSession, saveSession } from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server'); // network failure / CORS / server down
  }
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Session expired' : res.status === 404 ? 'Account not found' : `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  demoTraders: () => request<DemoTrader[]>('/dev/auth/traders'),
  accounts: (token: string) => request<AccountSummary[]>('/v1/me/accounts', {}, token),
  snapshot: (token: string, accountId?: string) =>
    request<Snapshot>(`/v1/me/snapshot${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`, {}, token),
};

/** Dev login (stand-in for the real IdP). Also used to renew the token when it nears expiry. */
export async function devLogin(brokerId: string, traderId: string, portalName?: string): Promise<Session> {
  const r = await request<{ token: string; expiresIn: number }>('/dev/auth/login', {
    method: 'POST',
    body: JSON.stringify({ brokerId, traderId }),
  });
  const session: Session = { token: r.token, expiresAt: Date.now() + r.expiresIn * 1000, brokerId, traderId, portalName };
  saveSession(session);
  return session;
}

export function logout() {
  clearSession();
}
