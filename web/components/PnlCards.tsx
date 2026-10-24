import type { Snapshot } from '@/lib/types';
import { fmtSignedUsd, fmtUsd, pnlTone } from '@/lib/format';

function Card({ label, value, tone, hint, stale, big }: { label: string; value: string; tone?: string; hint?: string; stale: boolean; big?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {stale && <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">STALE</span>}
      </p>
      <p className={`num mt-1 font-semibold ${big ? 'text-3xl' : 'text-2xl'} ${tone ?? ''} ${stale ? 'opacity-60' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function PnlCards({ pnl, stale }: { pnl: Snapshot['pnl']; stale: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card big label="Day P&L" value={fmtSignedUsd(pnl.totalUsd)} tone={pnlTone(pnl.totalUsd)} hint="realized (net) + unrealized" stale={stale} />
      <Card label="Realized (net)" value={fmtSignedUsd(pnl.realizedNetUsd)} tone={pnlTone(pnl.realizedNetUsd)} hint={`gross ${fmtSignedUsd(pnl.realizedGrossUsd)}`} stale={stale} />
      <Card label="Unrealized" value={fmtSignedUsd(pnl.unrealizedUsd)} tone={pnlTone(pnl.unrealizedUsd)} hint="open positions vs. mark" stale={stale} />
      <Card label="Commissions" value={fmtUsd(-pnl.commissionsUsd)} tone={pnl.commissionsUsd > 0 ? 'text-zinc-500 dark:text-zinc-400' : undefined} hint="this session" stale={stale} />
    </div>
  );
}
