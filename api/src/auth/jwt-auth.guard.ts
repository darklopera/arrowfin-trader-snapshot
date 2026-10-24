import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './public.decorator';
import { TokenService } from './token.service';

/**
 * Registered GLOBALLY (APP_GUARD): every route requires a valid bearer token
 * unless it is explicitly marked @Public(). This is the ONLY place a
 * TenantScope is created for HTTP requests.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: unknown = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw new UnauthorizedException();

    req.tenantScope = this.tokens.verify(header.slice('Bearer '.length)).scope;
    return true;
  }
}
