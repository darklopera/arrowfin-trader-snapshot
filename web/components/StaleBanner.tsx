import type { FeedStatus } from '@/hooks/useLiveFeed';
import { fmtTime } from '@/lib/format';

/**
 * Shown whenever the socket is not connected. The figures underneath are
 * dimmed and tagged STALE: the page never presents a number as live when it
 * cannot know whether fills are being missed.
 */
export function StaleBanner({ status, lastLiveAt }: { status: FeedStatus; lastLiveAt: number | null }) {
  const offline = status === 'offline';
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-400/60 bg-amber-100 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-black">STALE</span>
      <span>
        {offline ? 'You are offline.' : 'Live updates interrupted, reconnecting.'} Figures may be out of date
        {lastLiveAt ? <> · last live update <span className="num">{fmtTime(new Date(lastLiveAt).toISOString())}</span></> : null}.
      </span>
    </div>
  );
}
