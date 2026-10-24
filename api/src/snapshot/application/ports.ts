import Decimal from 'decimal.js';
import { FillInput, InstrumentSpec } from '../domain/types';
import { BrokerId, TenantScope } from '../../shared/tenant';

export interface AccountSummary {
  id: string;
  accountNumber: string;
  accountType: string;
  status: string;
}

export interface SnapshotData {
  account: AccountSummary & { balance: Decimal };
  fills: FillInput[];
  instruments: Map<string, InstrumentSpec>;
  marks: Map<string, Decimal>;
  marksAsOf: Date | null;
}

/**
 * Outbound port. Every method takes a TenantScope: the signature itself makes
 * it impossible to call the data layer without saying which tenant (and
 * trader) is asking.
 */
export interface SnapshotRepositoryPort {
  listAccounts(scope: TenantScope): Promise<AccountSummary[]>;
  /** null when the account does not exist OR is not owned by scope.traderId in scope.brokerId. */
  loadSnapshotData(scope: TenantScope, accountId: string): Promise<SnapshotData | null>;
}
export const SNAPSHOT_REPOSITORY = Symbol('SNAPSHOT_REPOSITORY');

export interface SnapshotUpdateEvent {
  accountId: string;
  version: number;
  snapshot: unknown;
  lastFill?: { symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; filledAt: string };
}

export interface SnapshotPublisherPort {
  publish(brokerId: BrokerId, event: SnapshotUpdateEvent): void;
}
export const SNAPSHOT_PUBLISHER = Symbol('SNAPSHOT_PUBLISHER');

export interface Clock {
  now(): Date;
}
export const CLOCK = Symbol('CLOCK');
