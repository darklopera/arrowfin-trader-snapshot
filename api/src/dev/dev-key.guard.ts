import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config/env';

const h = (s: string) => createHash('sha256').update(s).digest();

@Injectable()
export class DevKeyGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    const given = ctx.switchToHttp().getRequest().headers['x-dev-key'];
    // constant-time comparison on fixed-length digests
    if (typeof given !== 'string' || !timingSafeEqual(h(given), h(this.config.devApiKey ?? ''))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
