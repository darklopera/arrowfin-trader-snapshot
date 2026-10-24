import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { APP_CONFIG, AppConfig } from '../config/env';
import { asBrokerId, asTraderId, TenantScope } from '../shared/tenant';

export interface VerifiedToken {
  scope: TenantScope;
  /** seconds since epoch */
  expiresAt: number;
}

/**
 * JWT verification, written to close the classic holes:
 *  - `algorithms: ['HS256']` is PINNED. A token claiming alg=none, or RS256
 *    (the "use the public key as an HMAC secret" confusion attack), is rejected
 *    before any claim is looked at.
 *  - issuer + audience are required, so a token minted for another service
 *    that shares the secret cannot be replayed here.
 *  - exp is mandatory; a token without expiry is invalid.
 *  - The tenant (`bid`) and trader (`sub`) claims are re-validated against strict
 *    patterns: even a correctly signed token cannot carry a malformed id into
 *    a query or a log line.
 * Tokens carry IDs only: no name, email or balance.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  verify(token: string): VerifiedToken {
    try {
      const payload = jwt.verify(token, this.config.jwt.secret, {
        algorithms: ['HS256'],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        clockTolerance: 5,
      }) as jwt.JwtPayload;
      if (typeof payload.exp !== 'number') throw new Error('exp required');
      return {
        scope: { brokerId: asBrokerId(payload.bid), traderId: asTraderId(payload.sub) },
        expiresAt: payload.exp,
      };
    } catch {
      // One generic message: never tell the caller *why* (expired vs. bad signature vs. bad alg).
      throw new UnauthorizedException();
    }
  }

  /** Used by the dev login only. In production tokens come from the identity provider. */
  sign(scope: TenantScope): { token: string; expiresIn: number } {
    const expiresIn = this.config.jwt.ttlSeconds;
    const token = jwt.sign({ bid: scope.brokerId }, this.config.jwt.secret, {
      algorithm: 'HS256',
      subject: scope.traderId,
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
      expiresIn,
    });
    return { token, expiresIn };
  }
}
