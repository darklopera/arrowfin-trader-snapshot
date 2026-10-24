'use client';

import { useEffect, useRef, useState } from 'react';
import type { Position } from '@/lib/types';
import { fmtPrice, fmtQty, fmtSignedUsd, fmtUsd, pnlTone } from '@/lib/format';
import { EmptyState } from './states';

/** Symbols whose row changed since the previous render: they flash once. */
function useChanged(positions: Position[]) {
  const prev = useRef(new Map<string, string>());
  const [changed, setChanged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Map(positions.map((p) => [p.symbol, `${p.netQty}|${p.avgPrice}|${p.markPrice}`]));
    const diff = new Set<string>();
    if (prev.current.size > 0) {
      for (const [sym, sig] of next) if (prev.current.get(sym) !== sig) diff.add(sym);
    }
    prev.current = next;
    if (diff.size === 0) return;
    setChanged(diff);
    const t = setTimeout(() => setChanged(new Set()), 1500);
    return () => clearTimeout(t);
  }, [positions]);

  return changed;
}

export function PositionsTable({ positions, stale, fillsToday }: { positions: Position[]; stale: boolean; fillsToday: number }) {
  const changed = useChanged(positions);

  return (
    <section aria-labelledby="pos-title" className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-5 py-3">
        <h2 id="pos-title" className="text-xs font-medium uppercase tracking-wider text-zinc-500">Open positions</h2>
        <span className="num text-xs text-zinc-500">{positions.length} open</span>
      </div>
      {positions.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            title="No open positions"
            detail={fillsToday === 0 ? 'No trading activity in this session yet.' : 'All positions were closed this session. Realized P&L is above.'}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[640px] text-sm ${stale ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="border-y border-zinc-200 text-left text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                <th className="px-5 py-2 font-medium">Instrument</th>
                <th className="px-3 py-2 text-right font-medium">Net qty</th>
                <th className="px-3 py-2 text-right font-medium">Avg price</th>
                <th className="px-3 py-2 text-right font-medium">Mark</th>
                <th className="px-3 py-2 text-right font-medium">Notional</th>
                <th className="px-5 py-2 text-right font-medium">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/70 ${changed.has(p.symbol) ? 'row-flash' : ''}`}>
                  <td className="px-5 py-3 font-semibold">
                    {p.symbol}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${p.netQty > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                      {p.netQty > 0 ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className={`num px-3 py-3 text-right ${p.netQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtQty(p.netQty)}</td>
                  <td className="num px-3 py-3 text-right">{fmtPrice(p.avgPrice)}</td>
                  <td className="num px-3 py-3 text-right">{p.markPrice === null ? <span title="No mark available: valued at cost" className="text-amber-500">n/a</span> : fmtPrice(p.markPrice)}</td>
                  <td className="num px-3 py-3 text-right">{fmtUsd(p.notionalUsd)}</td>
                  <td className={`num px-5 py-3 text-right font-medium ${pnlTone(p.unrealizedPnlUsd)}`}>{fmtSignedUsd(p.unrealizedPnlUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
