import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantScope } from '../shared/tenant';

export const CurrentScope = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantScope => {
  return ctx.switchToHttp().getRequest().tenantScope;
});
