'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { shouldApply } from '@/lib/snapshot-state';
import type { AccountSummary, Snapshot, SnapshotUpdateEvent } from '@/lib/types';

const key = (traderId: string, accountId: string | undefined) => ['snapshot', traderId, accountId ?? 'default'] as const;
// 401 (session) and 404 (not yours / not found) will not get better by retrying.
const retry = (n: number, e: unknown) => !(e instanceof ApiError && (e.status === 401 || e.status === 404)) && n < 2;

export function useAccounts(traderId: string, getToken: () => string) {
  return useQuery<AccountSummary[]>({
    queryKey: ['accounts', traderId],
    queryFn: () => api.accounts(getToken()),
    retry,
  });
}

export function useSnapshot(traderId: string, accountId: string | undefined, getToken: () => string) {
  const qc = useQueryClient();

  const query = useQuery<Snapshot>({
    queryKey: key(traderId, accountId),
    queryFn: () => api.snapshot(getToken(), accountId),
    retry,
    refetchOnWindowFocus: false, // the socket is the live channel; reconnect triggers the resync
  });

  /** Apply a pushed event to the cache, dropping duplicates and out-of-order events. */
  const applyUpdate = useCallback(
    (e: SnapshotUpdateEvent) => {
      qc.setQueryData<Snapshot>(key(traderId, e.accountId), (current) => (shouldApply(current, e) ? e.snapshot : current));
      // the "default account" view is the same account: keep it in step too
      qc.setQueryData<Snapshot>(key(traderId, undefined), (current) =>
        current && current.account.id === e.accountId && shouldApply(current, e) ? e.snapshot : current,
      );
    },
    [qc, traderId],
  );

  const resync = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['snapshot', traderId] });
  }, [qc, traderId]);

  return { query, applyUpdate, resync };
}
