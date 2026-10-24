/**
 * TenantScope is the ONLY way application code learns who is asking.
 *
 * It is built in exactly one place (the JWT guard) from VERIFIED token claims
 * and is then passed explicitly down to every repository. There is no code path
 * that builds one from a request body, query string, header or URL parameter.
 * Repositories require it in their signature, so "I forgot the tenant" is a
 * compile error, not a production incident.
 */
declare const brand: unique symbol;
export type BrokerId = string & { readonly [brand]: 'BrokerId' };
export type TraderId = string & { readonly [brand]: 'TraderId' };

const BROKER_RE = /^BRK-[A-Z0-9]{2,16}$/;
const TRADER_RE = /^T-\d{1,10}$/;

export function asBrokerId(v: unknown): BrokerId {
  if (typeof v !== 'string' || !BROKER_RE.test(v)) throw new Error('invalid broker id');
  return v as BrokerId;
}
export function asTraderId(v: unknown): TraderId {
  if (typeof v !== 'string' || !TRADER_RE.test(v)) throw new Error('invalid trader id');
  return v as TraderId;
}

export interface TenantScope {
  readonly brokerId: BrokerId;
  readonly traderId: TraderId;
}

export const ACCOUNT_ID_RE = /^ACC-\d{1,10}$/;
