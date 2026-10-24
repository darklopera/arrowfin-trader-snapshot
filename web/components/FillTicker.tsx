import type { LastFill } from '@/lib/types';
import { fmtPrice, fmtTime } from '@/lib/format';

export interface TickerFill extends LastFill { key: string }

/** Fills received on THIS page since it loaded (not history). */
export function FillTicker({ fills }: { fills: TickerFill[] }) {
  return (
    <section aria-labelledby="fills-title" className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id="fills-title" className="text-xs font-medium uppercase tracking-wider text-zinc-500">Live fills</h2>
      {fills.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Waiting for fills… new executions appear here as they arrive.</p>
      ) : (
        <ul aria-live="polite" className="mt-3 space-y-2">
          {fills.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="num text-zinc-500">{fmtTime(f.filledAt)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${f.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>{f.side}</span>
              <span className="num font-medium">{f.quantity} {f.symbol}</span>
              <span className="num text-zinc-500">@ {fmtPrice(f.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
