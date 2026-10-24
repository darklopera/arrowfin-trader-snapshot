import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Matches, Max, Min } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { ACCOUNT_ID_RE } from '../shared/tenant';
import { DevKeyGuard } from './dev-key.guard';
import { DevFillsService } from './dev-fills.service';

export class DevFillDto {
  @Matches(ACCOUNT_ID_RE) account_id!: string;
  @Matches(/^[A-Z0-9]{1,6}$/) instrument_symbol!: string;
  @IsIn(['BUY', 'SELL']) side!: 'BUY' | 'SELL';
  @IsInt() @Min(1) @Max(100) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 6 }) @IsPositive() price!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) commission_usd?: number;
}

/** POST /dev/fills  (header x-dev-key). Registered only when DevModule is imported. */
@Controller('dev/fills')
export class DevFillsController {
  constructor(private readonly service: DevFillsService) {}

  @Public() // bypasses the JWT guard; protected by DevKeyGuard instead
  @UseGuards(DevKeyGuard)
  @Post()
  @HttpCode(202)
  create(@Body() dto: DevFillDto) {
    return this.service.ingest(dto);
  }
}
