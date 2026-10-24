/**
 * Where the access token lives (read this before judging it).
 *
 * DEMO: sessionStorage. Scoped to the tab, gone when it closes, never sent
 * automatically (so no CSRF). Trade-off: any XSS could read it.
 * PRODUCTION: do not keep a bearer token in JS-reachable storage. Put the
 * session behind a Next.js route handler (BFF) that holds an httpOnly,
 * Secure, SameSite=Strict cookie and forwards to the API; the socket token
 * is then a short-lived, single-purpose ticket fetched from that BFF.
 * Every storage access is wrapped: private windows and blocked storage throw.
 */
export interface Session {
  token: string;
  expiresAt: number; // ms epoch
  brokerId: string;
  traderId: string;
  /** Broker's white-label portal name, only to brand the header. */
  portalName?: string;
}

const KEY = 'arrowfin.session';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: session lives in memory only */ }
}

export function clearSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
