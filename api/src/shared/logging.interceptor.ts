import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Access log with a deliberately tiny vocabulary: method, ROUTE TEMPLATE (not
 * the raw URL), status, duration, and the pseudonymous ids from the verified
 * token. Never bodies, never query strings, never response payloads, never
 * headers: those are where PII and tokens hide. Using the route template also
 * means attacker-controlled path text cannot forge log lines (log injection).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const started = Date.now();
    const line = (status: number) =>
      `${req.method} ${req.route?.path ?? 'unmatched'} ${status} ${Date.now() - started}ms` +
      (req.tenantScope ? ` trader=${req.tenantScope.traderId} broker=${req.tenantScope.brokerId}` : '');

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(line(res.statusCode)),
        error: (e) => this.logger.warn(line(typeof e?.getStatus === 'function' ? e.getStatus() : 500)),
      }),
    );
  }
}
