export type RiskLevel = 'low' | 'elevated' | 'high';

export interface Position {
  symbol: string;
  netQty: number;
  avgPrice: number;
  markPrice: number | null;
  notionalUsd: number;
  unrealizedPnlUsd: number;
}

export interface Snapshot {
  account: { id: string; accountNumberMasked: string; type: string; status: string };
  positions: Position[];
  pnl: { realizedGrossUsd: number; commissionsUsd: number; realizedNetUsd: number; unrealizedUsd: number; totalUsd: number };
  risk: { score: number; level: RiskLevel; grossNotionalUsd: number };
  activity: { fillsToday: number; ordersToday: number };
  asOf: string;
  session: { startedAt: string };
  marksAsOf: string | null;
  version: number;
}

export interface AccountSummary {
  id: string;
  accountNumberMasked: string;
  type: string;
  status: string;
}

export interface LastFill {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  filledAt: string;
}

export interface SnapshotUpdateEvent {
  accountId: string;
  version: number;
  snapshot: Snapshot;
  lastFill?: LastFill;
}

export interface DemoTrader {
  traderId: string;
  brokerId: string;
  brokerName: string;
  whiteLabelName: string;
  accounts: number;
}
