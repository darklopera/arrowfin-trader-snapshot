import Decimal from 'decimal.js';

export type Side = 'BUY' | 'SELL';

/** A single execution. Several fills may share one orderId (partial fills). */
export interface FillInput {
  id: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: Decimal;
  filledAt: Date;
  orderId: string;
  commissionUsd: Decimal;
}

export interface InstrumentSpec {
  symbol: string;
  /** USD per 1.0 of price movement, per contract. MES=5, ES=50, 6E=125000. */
  pointValueUsd: Decimal;
}

export interface SnapshotInput {
  fills: FillInput[];
  instruments: ReadonlyMap<string, InstrumentSpec>;
  marks: ReadonlyMap<string, Decimal>;
  balance: Decimal;
  /** Start of the current CME Globex session (UTC instant). */
  sessionStart: Date;
}

export type RiskLevel = 'low' | 'elevated' | 'high';

export interface PositionView {
  symbol: string;
  /** Signed: >0 long, <0 short. */
  netQty: number;
  avgPrice: number;
  /** null when we have no mark for the symbol (notional falls back to avgPrice). */
  markPrice: number | null;
  notionalUsd: number;
  unrealizedPnlUsd: number;
}

export interface SnapshotResult {
  positions: PositionView[];
  pnl: {
    realizedGrossUsd: number;
    commissionsUsd: number;
    /** realizedGross - commissions, session-to-date. */
    realizedNetUsd: number;
    unrealizedUsd: number;
    totalUsd: number;
  };
  risk: {
    /** min(100, grossNotional / balance * 100), one decimal. */
    score: number;
    level: RiskLevel;
    grossNotionalUsd: number;
  };
  activity: { fillsToday: number; ordersToday: number };
}

export class UnknownInstrumentError extends Error {
  constructor(symbol: string) {
    super(`No instrument specification for symbol ${symbol}`);
    this.name = 'UnknownInstrumentError';
  }
}
