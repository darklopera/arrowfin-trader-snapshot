import type { FeedStatus } from '@/hooks/useLiveFeed';

const MAP: Record<FeedStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'Live', dot: 'bg-emerald-500 live-dot', text: 'text-emerald-600 dark:text-emerald-400' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-500 live-dot', text: 'text-amber-600 dark:text-amber-400' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-amber-500 live-dot', text: 'text-amber-600 dark:text-amber-400' },
  offline: { label: 'Offline', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

export function ConnectionBadge({ status }: { status: FeedStatus }) {
  const m = MAP[status];
  return (
    <span role="status" className={`inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700 ${m.text}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}
