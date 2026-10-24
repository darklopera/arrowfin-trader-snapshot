import type { Snapshot } from './types';

/**
 * Decides whether a pushed event may replace what we show.
 *
 * Events carry the FULL snapshot plus a per-account monotonic `version`
 * (= fills applied). That makes updates idempotent and order-independent:
 *  - duplicate or late event  -> version <= current -> ignored
 *  - a newer event after a gap -> applied; it already contains everything the
 *    missed events would have added (state, not deltas), so a gap heals itself.
 */
export function shouldApply(current: Snapshot | undefined, incoming: { version: number }): boolean {
  return current === undefined || incoming.version > current.version;
}
