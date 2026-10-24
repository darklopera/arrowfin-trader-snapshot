'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { devLogin, logout } from '@/lib/api';
import { Session, loadSession } from '@/lib/session';
import { LoginPanel } from './LoginPanel';
import { SnapshotPage } from './SnapshotPage';
import { SnapshotSkeleton } from './states';

export function AppShell() {
  const [queryClient] = useState(() => new QueryClient());
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const renewing = useRef<Promise<void> | null>(null);

  const apply = useCallback((s: Session | null) => { sessionRef.current = s; setSession(s); }, []);

  useEffect(() => { apply(loadSession()); setReady(true); }, [apply]);

  const signOut = useCallback(() => {
    logout();
    queryClient.clear(); // never let the next identity see the previous one's cached data
    apply(null);
  }, [apply, queryClient]);

  /** One in-flight renewal at a time. Production: refresh-token / BFF call instead of a dev login. */
  const renewToken = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur) return Promise.reject(new Error('no session'));
    renewing.current ??= devLogin(cur.brokerId, cur.traderId, cur.portalName)
      .then(apply)
      .finally(() => { renewing.current = null; });
    return renewing.current;
  }, [apply]);

  // Renew 60 s before expiry so REST calls and the next socket handshake always carry a valid token.
  useEffect(() => {
    if (!session) return;
    const ms = Math.max(session.expiresAt - Date.now() - 60_000, 5_000);
    const t = setTimeout(() => { renewToken().catch(signOut); }, ms);
    return () => clearTimeout(t);
  }, [session, renewToken, signOut]);

  return (
    <QueryClientProvider client={queryClient}>
      {!ready ? (
        <div className="mx-auto max-w-6xl px-4 py-6"><SnapshotSkeleton /></div>
      ) : session ? (
        <SnapshotPage key={session.traderId} session={session} getToken={() => sessionRef.current?.token ?? ''} renewToken={renewToken} onSignOut={signOut} />
      ) : (
        <LoginPanel onLogin={apply} />
      )}
    </QueryClientProvider>
  );
}
