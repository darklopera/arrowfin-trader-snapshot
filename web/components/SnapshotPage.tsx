'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fmtTime } from '@/lib/format';
import type { Session } from '@/lib/session';
import type { SnapshotUpdateEvent } from '@/lib/types';
import { useLiveFeed } from '@/hooks/useLiveFeed';
import { useAccounts, useSnapshot } from '@/hooks/useSnapshot';
import { ConnectionBadge } from './ConnectionBadge';
import { FillTicker, TickerFill } from './FillTicker';
import { PnlCards } from './PnlCards';
import { PositionsTable } from './PositionsTable';
import { RiskCard } from './RiskCard';
import { StaleBanner } from './StaleBanner';
import { EmptyState, ErrorState, SnapshotSkeleton } from './states';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  session: Session;
  getToken: () => string;
  renewToken: () => Promise<void>;
  onSignOut: () => void;
}

export function SnapshotPage({ session, getToken, renewToken, onSignOut }: Props) {
  const [accountId, setAccountId] = useState<string | undefined>(undefined); // undefined = server picks the default
  const [fills, setFills] = useState<TickerFill[]>([]);
  const accounts = useAccounts(session.traderId, getToken);
  const { query, applyUpdate, resync } = useSnapshot(session.traderId, accountId, getToken);

  const onUpdate = useCallback(
    (e: SnapshotUpdateEvent) => {
      applyUpdate(e);
      if (e.lastFill) setFills((prev) => [{ ...e.lastFill!, key: `${e.accountId}-${e.version}` }, ...prev].slice(0, 6));
    },
    [applyUpdate],
  );

  const feed = useLiveFeed({ getToken, renewToken, onUpdate, onResync: resync, onAuthLost: onSignOut });

  // A 401 on REST means the session is gone (expired and could not be renewed).
  const error = query.error;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) renewToken().then(() => query.refetch(), onSignOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const data = query.data;
  const shownAccountId = accountId ?? data?.account.id ?? '';
  const stale = !feed.isLive;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{session.portalName ?? 'Trader portal'}</p>
          <h1 className="text-xl font-bold">Daily Snapshot <span className="num ml-1 text-sm font-normal text-zinc-500">{session.traderId}</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.data && accounts.data.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Account
              <select
                value={shownAccountId}
                onChange={(e) => { setAccountId(e.target.value); setFills([]); }}
                className="num rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {accounts.data.map((a) => (
                  <option key={a.id} value={a.id}>{a.id} · {a.accountNumberMasked} · {a.type}{a.status !== 'active' ? ` (${a.status})` : ''}</option>
                ))}
              </select>
            </label>
          )}
          <ConnectionBadge status={feed.status} />
          <ThemeToggle />
          <button onClick={onSignOut} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Sign out
          </button>
        </div>
      </header>

      {stale && data && <StaleBanner status={feed.status} lastLiveAt={feed.lastLiveAt} />}

      {accounts.isSuccess && accounts.data.length === 0 && (
        <EmptyState title="No trading accounts" detail="This trader does not have an account yet." />
      )}

      {query.isPending && accounts.data?.length !== 0 && <SnapshotSkeleton />}

      {query.isError && !(error instanceof ApiError && error.status === 401) && (
        <ErrorState
          title={error instanceof ApiError && error.status === 404 ? 'Account not found' : 'Could not load the snapshot'}
          detail={error instanceof ApiError && error.status === 0 ? 'The server is unreachable. Check your connection.' : undefined}
          onRetry={() => query.refetch()}
        />
      )}

      {data && (
        <>
          {data.account.status !== 'active' && (
            <p role="status" className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              This account is <strong>{data.account.status}</strong>. Figures are shown read-only.
            </p>
          )}
          <RiskCard risk={data.risk} stale={stale} />
          <PnlCards pnl={data.pnl} stale={stale} />
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <PositionsTable positions={data.positions} stale={stale} fillsToday={data.activity.fillsToday} />
            </div>
            <FillTicker fills={fills} />
          </div>
          <footer className="num flex flex-wrap gap-x-6 gap-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            <span>{data.activity.fillsToday} {data.activity.fillsToday === 1 ? 'fill' : 'fills'} · {data.activity.ordersToday} {data.activity.ordersToday === 1 ? 'order' : 'orders'} this session</span>
            <span>session opened {fmtTime(data.session.startedAt)} · {new Date(data.session.startedAt).toISOString().slice(0, 10)}</span>
            {data.marksAsOf && <span>marks as of {fmtTime(data.marksAsOf)}</span>}
            <span>v{data.version}</span>
          </footer>
        </>
      )}
    </main>
  );
}
