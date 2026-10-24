'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { API_URL, ApiError, api, devLogin } from '@/lib/api';
import type { Session } from '@/lib/session';
import type { DemoTrader } from '@/lib/types';
import { EmptyState, ErrorState } from './states';
import { ThemeToggle } from './ThemeToggle';

// Labels derived from the data's behaviour (not from any free-text field).
const HINTS: Record<string, string> = {
  'T-005': 'two accounts · high-risk position',
  'T-010': 'zero balance · open position',
  'T-011': 'no trading activity (empty state)',
};

/**
 * DEMO ONLY. The dataset has no credentials, so this screen stands in for each
 * broker's own white-label sign-in. It lists IDs and broker names only.
 */
export function LoginPanel({ onLogin }: { onLogin: (s: Session) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const traders = useQuery({ queryKey: ['demo-traders'], queryFn: api.demoTraders, retry: 1 });

  const signIn = async (t: DemoTrader) => {
    setPending(t.traderId); setError(null);
    try { onLogin(await devLogin(t.brokerId, t.traderId, t.whiteLabelName)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Sign-in failed'); setPending(null); }
  };

  const byBroker = new Map<string, DemoTrader[]>();
  for (const t of traders.data ?? []) byBroker.set(t.brokerId, [...(byBroker.get(t.brokerId) ?? []), t]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Trader Daily Snapshot</h1>
          <p className="mt-1 text-sm text-zinc-500">Demo sign-in: pick an identity. In production each broker signs in through its own portal.</p>
        </div>
        <ThemeToggle />
      </div>

      {traders.isPending && <p role="status" className="text-sm text-zinc-500">Loading demo identities…</p>}
      {traders.isError && (
        <ErrorState
          title="Cannot reach the API"
          detail={`Expected it at ${API_URL} with ENABLE_DEV_ENDPOINTS=true. See the README for the 3 commands to start it.`}
          onRetry={() => traders.refetch()}
        />
      )}
      {traders.isSuccess && traders.data.length === 0 && <EmptyState title="No demo identities found" detail="Did the seed run?" />}
      {error && <p role="alert" className="mb-4 text-sm text-rose-500">{error}</p>}

      <div className="space-y-6">
        {[...byBroker.entries()].map(([brokerId, list]) => (
          <section key={brokerId} aria-label={list[0].whiteLabelName}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {list[0].whiteLabelName} <span className="normal-case text-zinc-400">· {list[0].brokerName}</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((t) => (
                <li key={t.traderId}>
                  <button
                    onClick={() => signIn(t)}
                    disabled={pending !== null}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-emerald-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
                  >
                    <span className="num font-semibold">{t.traderId}</span>
                    <span className="ml-2 text-xs text-zinc-500">{t.accounts} account{t.accounts === 1 ? '' : 's'}</span>
                    {HINTS[t.traderId] && <span className="mt-0.5 block text-xs text-emerald-600 dark:text-emerald-400">{HINTS[t.traderId]}</span>}
                    {pending === t.traderId && <span className="block text-xs text-zinc-500">Signing in…</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
