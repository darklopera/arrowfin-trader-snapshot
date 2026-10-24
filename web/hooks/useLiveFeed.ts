'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import type { SnapshotUpdateEvent } from '@/lib/types';

export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface Options {
  getToken: () => string;
  /** Resolves with a fresh token (or rejects when the user must log in again). */
  renewToken: () => Promise<void>;
  onUpdate: (e: SnapshotUpdateEvent) => void;
  /** Called on EVERY (re)connect: re-read the truth over REST. */
  onResync: () => void;
  onAuthLost: () => void;
}

/**
 * WebSocket lifecycle. The one rule that keeps numbers honest:
 *
 *   NEVER present data as live unless the socket is connected right now.
 *
 * - `status` is exposed so the UI can dim figures and show a STALE banner the
 *   moment the socket drops (socket.io pings every 10 s, so a silently dead
 *   connection is detected within ~15 s, not "eventually").
 * - On every connect, including the first, `onResync` refetches the snapshot
 *   over REST. The first connect matters too: a fill can land between the REST
 *   response and the socket joining its room.
 * - Events are full snapshots with a per-account `version`; the consumer drops
 *   duplicates and out-of-order events (see lib/snapshot-state.ts).
 * - Reconnects use exponential backoff WITH jitter (1 s -> 15 s, +-50%) so a
 *   feed outage does not become a thundering herd when it comes back.
 * - The server closes the socket when the JWT expires ('io server disconnect',
 *   which socket.io does not retry on its own). We renew, then reconnect.
 */
export function useLiveFeed(opts: Options) {
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [lastLiveAt, setLastLiveAt] = useState<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts; // always call the latest callbacks without re-creating the socket

  useEffect(() => {
    let disposed = false;
    let renewing = false;

    const socket: Socket = io(API_URL, {
      transports: ['websocket'],
      // a function, so every reconnect attempt sends the CURRENT token
      auth: (cb) => cb({ token: optsRef.current.getToken() }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    });

    const renewAndReconnect = async () => {
      if (renewing || disposed) return;
      renewing = true;
      try {
        await optsRef.current.renewToken();
        if (!disposed) socket.connect();
      } catch {
        if (!disposed) optsRef.current.onAuthLost();
      } finally {
        renewing = false;
      }
    };

    socket.on('connect', () => {
      setStatus('live');
      setLastLiveAt(Date.now());
      optsRef.current.onResync();
    });

    socket.on('snapshot:update', (e: SnapshotUpdateEvent) => {
      setLastLiveAt(Date.now());
      optsRef.current.onUpdate(e);
    });

    socket.on('disconnect', (reason) => {
      if (disposed) return;
      setStatus('reconnecting');
      if (reason === 'io server disconnect') void renewAndReconnect(); // token expired
    });

    socket.on('connect_error', () => {
      if (disposed) return;
      // socket.active === false: the server REFUSED us (bad/expired token) and
      // socket.io will not retry by itself. Otherwise it is a transport error
      // and the built-in backoff is already retrying.
      if (!socket.active) void renewAndReconnect();
      else setStatus((s) => (s === 'live' ? 'reconnecting' : s === 'connecting' ? 'connecting' : 'reconnecting'));
    });

    const onOffline = () => setStatus('offline');
    window.addEventListener('offline', onOffline);

    return () => {
      disposed = true;
      window.removeEventListener('offline', onOffline);
      socket.removeAllListeners();
      socket.close();
    };
  }, []);

  return { status, lastLiveAt, isLive: status === 'live' };
}
