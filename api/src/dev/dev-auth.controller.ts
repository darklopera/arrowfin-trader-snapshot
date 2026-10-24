import { Body, Controller, Get, UnauthorizedException, Post } from '@nestjs/common';
import { Matches } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../shared/prisma.service';
import { asBrokerId, asTraderId } from '../shared/tenant';
import { AdminPrisma } from './admin-prisma';

export class DevLoginDto {
  @Matches(/^BRK-[A-Z0-9]{2,16}$/) brokerId!: string;
  @Matches(/^T-\d{1,10}$/) traderId!: string;
}

/**
 * Stand-in for the platform's real identity provider (the dataset has no
 * passwords). It still goes through the production path for the one check
 * that matters: the trader must exist INSIDE the claimed broker, verified by
 * the RLS-protected connection.
 */
@Controller('dev/auth')
export class DevAuthController {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly admin: AdminPrisma,
  ) {}

  /** Lists demo identities for the login screen. IDs and broker names only: no PII. */
  @Public()
  @Get('traders')
  async traders() {
    const rows = await this.admin.client.trader.findMany({
      select: { id: true, brokerId: true, broker: { select: { name: true, whiteLabelName: true } }, _count: { select: { accounts: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map((t) => ({
      traderId: t.id, brokerId: t.brokerId, brokerName: t.broker.name,
      whiteLabelName: t.broker.whiteLabelName, accounts: t._count.accounts,
    }));
  }

  @Public()
  @Post('login')
  async login(@Body() dto: DevLoginDto) {
    const scope = { brokerId: asBrokerId(dto.brokerId), traderId: asTraderId(dto.traderId) };
    const trader = await this.prisma.withTenant(scope.brokerId, (tx) =>
      tx.trader.findFirst({ where: { id: scope.traderId, brokerId: scope.brokerId }, select: { id: true } }),
    );
    if (!trader) throw new UnauthorizedException();
    return { ...this.tokens.sign(scope), trader: { id: scope.traderId, brokerId: scope.brokerId } };
  }
}
