import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { CurrentScope } from '../../auth/current-scope.decorator';
import { ACCOUNT_ID_RE, TenantScope } from '../../shared/tenant';
import { GetSnapshotUseCase, maskAccountNumber } from '../application/get-snapshot.use-case';

export class SnapshotQuery {
  @IsOptional()
  @Matches(ACCOUNT_ID_RE, { message: 'accountId must look like ACC-1234' })
  accountId?: string;
}

/**
 * Note what is NOT here: no :traderId, no :brokerId, no body. "Whose data?" is
 * answered exclusively by the verified token. The only client-supplied
 * identifier is an optional accountId, and it is *checked against* the token's
 * trader+tenant, never trusted.
 */
@Controller('v1/me')
export class SnapshotController {
  constructor(private readonly getSnapshot: GetSnapshotUseCase) {}

  @Get('accounts')
  async accounts(@CurrentScope() scope: TenantScope) {
    const accounts = await this.getSnapshot.listAccounts(scope);
    return accounts.map((a) => ({
      id: a.id, accountNumberMasked: maskAccountNumber(a.accountNumber), type: a.accountType, status: a.status,
    }));
  }

  @Get('snapshot')
  async snapshot(@CurrentScope() scope: TenantScope, @Query() query: SnapshotQuery) {
    const snapshot = await this.getSnapshot.execute(scope, query.accountId);
    // Same 404 whether the account is missing, belongs to another trader, or to
    // another broker: no existence oracle.
    if (!snapshot) throw new NotFoundException('Account not found');
    return snapshot;
  }
}
