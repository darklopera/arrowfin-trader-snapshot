const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 });

export const fmtUsd = (v: number) => usd.format(v);
/** +$1,234.00 / -$12.50 / $0.00 : explicit sign makes P&L scannable. */
export const fmtSignedUsd = (v: number) => (v > 0 ? '+' : '') + usd.format(v);
export const fmtPrice = (v: number) => num.format(v);
export const fmtQty = (v: number) => (v > 0 ? `+${v}` : `${v}`);
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Chicago' }) + ' CT';

export const pnlTone = (v: number) => (v > 0 ? 'text-emerald-500' : v < 0 ? 'text-rose-500' : 'text-zinc-400');
