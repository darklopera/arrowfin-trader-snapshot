import type { Snapshot } from '@/lib/types';
import { fmtUsd } from '@/lib/format';

const TONE = {
  low: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'LOW' },
  elevated: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'ELEVATED' },
  high: { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', label: 'HIGH' },
} as const;

/**
 * The risk indicator. Above 75 it must be unmissable and must not rely on
 * colour alone: the whole card gets a red ring + pulse, a full-width alert bar
 * with an icon and plain words appears, and it is announced to screen readers
 * (role="alert"). (prefers-reduced-motion disables the pulse; the red ring and
 * the banner remain.)
 */
export function RiskCard({ risk, stale }: { risk: Snapshot['risk']; stale: boolean }) {
  const tone = TONE[risk.level];
  const high = risk.level === 'high';

  return (
    <section
      aria-labelledby="risk-title"
      className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${
        high ? 'border-rose-500 ring-2 ring-rose-500 risk-pulse' : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {high && (
        <div role="alert" className="flex items-center gap-3 bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white">
          <span aria-hidden className="text-lg leading-none">⚠</span>
          HIGH RISK: exposure is {risk.score}% of the account balance, above the 75% threshold.
        </div>
      )}
      <div className={`p-5 ${stale ? 'opacity-60' : ''}`}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="risk-title" className="text-xs font-medium uppercase tracking-wider text-zinc-500">Risk indicator</h2>
            <p className={`num mt-1 text-5xl font-bold ${tone.text}`}>
              {risk.score.toFixed(1)}
              <span className="ml-1 text-xl text-zinc-400">/ 100</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded px-2 py-1 text-xs font-bold tracking-wider ${high ? 'bg-rose-600 text-white' : `border border-current ${tone.text}`}`}>
              {tone.label}
            </span>
            <p className="mt-2 text-xs text-zinc-500">Gross exposure</p>
            <p className="num text-sm font-medium">{fmtUsd(risk.grossNotionalUsd)}</p>
          </div>
        </div>

        <div className="relative mt-5" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={risk.score} aria-label="Risk score">
          <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${risk.score}%` }} />
          </div>
          {[50, 75].map((t) => (
            <div key={t} className="absolute top-0 h-3 w-px bg-zinc-500/70" style={{ left: `${t}%` }}>
              <span className="num absolute left-1/2 top-4 -translate-x-1/2 text-[10px] text-zinc-500">{t}</span>
            </div>
          ))}
        </div>
        <div className="h-4" aria-hidden />
      </div>
    </section>
  );
}
