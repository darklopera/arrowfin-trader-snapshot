import { Inject, Injectable } from '@nestjs/common';
import { currentSessionStart } from '../domain/session';
import { computeSnapshot } from '../domain/snapshot.calculator';
import { SnapshotResult } from '../domain/types';
import { TenantScope } from '../../shared/tenant';
import { AccountSummary, CLOCK, Clock, SNAPSHOT_REPOSITORY, SnapshotRepositoryPort } from './ports';

export interface SnapshotDto extends SnapshotResult {
  account: { id: string; accountNumberMasked: string; type: string; status: string };
  asOf: string;
  session: { startedAt: string };
  marksAsOf: string | null;
  /**
   * Monotonic per account (= number of fills applied). Lets a client discard
   * out-of-order events and detect that it missed some after a reconnect.
   */
  version: number;
}

/** "APX-100001" -> "••••0001". The full number is an account identifier we do not need to ship. */
export const maskAccountNumber = (n: string) => `••••${n.slice(-4)}`;

@Injectable()
export class GetSnapshotUseCase {
  constructor(
    @Inject(SNAPSHOT_REPOSITORY) private readonly repo: SnapshotRepositoryPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  listAccounts(scope: TenantScope): Promise<AccountSummary[]> {
    return this.repo.listAccounts(scope);
  }

  /** accountId omitted -> the trader's first ACTIVE account (a sensible default for the widget). */
  async execute(scope: TenantScope, accountId?: string): Promise<SnapshotDto | null> {
    let target = accountId;
    if (!target) {
      const accounts = await this.repo.listAccounts(scope);
      target = (accounts.find((a) => a.status === 'active') ?? accounts[0])?.id;
      if (!target) return null;
    }

    const data = await this.repo.loadSnapshotData(scope, target);
    if (!data) return null;

    const asOf = this.clock.now();
    const sessionStart = currentSessionStart(asOf);
    const result = computeSnapshot({
      fills: data.fills,
      instruments: data.instruments,
      marks: data.marks,
      balance: data.account.balance,
      sessionStart,
    });

    // NOTE: the balance itself is deliberately NOT returned. The client needs
    // the risk score, not a regulated figure it never displays.
    return {
      ...result,
      account: {
        id: data.account.id,
        accountNumberMasked: maskAccountNumber(data.account.accountNumber),
        type: data.account.accountType,
        status: data.account.status,
      },
      asOf: asOf.toISOString(),
      session: { startedAt: sessionStart.toISOString() },
      marksAsOf: data.marksAsOf?.toISOString() ?? null,
      version: data.fills.length,
    };
  }
}
