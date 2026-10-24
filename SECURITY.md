# SECURITY

Threat model in one line: **a legitimate, logged-in trader of broker A tries to read, or receive, anything that belongs to broker B (or to another trader of A).** A fill pushed to the wrong tenant is the worst outcome here, so that is the attacker I designed against. Each claim below has a test.

## 1. Auth model

**REST.** Every route needs `Authorization: Bearer <JWT>`. The guard is global (`APP_GUARD`), so authentication is the default and opting out needs an explicit `@Public()`: a forgotten decorator fails closed with a 401. The token is verified in `auth/token.service.ts`:

- `HS256` is pinned, so `alg: none` and algorithm-confusion tokens are rejected before any claim is read.
- `issuer`, `audience` and `exp` are mandatory.
- Identity is two claims, `sub` (trader) and `bid` (broker/tenant), both re-validated against strict patterns. The token carries ids only, no name, email or balance.
- Every failure returns the same bare 401, so the caller learns nothing about why.

The result is a `TenantScope {brokerId, traderId}`, created **only** here. No code path builds one from a URL, body, query string or header.

**WebSocket.** Authentication happens at connection time, in the Socket.IO handshake middleware (`realtime/fills.gateway.ts`), never per message. The token travels in the handshake `auth` payload, not in the URL, which would reach proxy logs (a test confirms a token in the query string is refused). Without a valid token the connection never exists, and the server closes the socket when the JWT expires.

**What stops tenant A from subscribing to tenant B's stream?** There is nothing to call. The *server* chooses the rooms a socket joins: the accounts the token's trader owns inside the token's broker, with the broker in the room name (`acct:{broker}:{account}`). The gateway has **no inbound message handlers**, so a client cannot ask to join anything. `test/ws.e2e-spec.ts` proves that a fill reaches only its owner (not a colleague of the same broker, not another broker), and that an attacker emitting `join` or `subscribe` for someone else's room receives nothing.

## 2. Tenant isolation

Three independent layers, so one mistake is never enough:

1. **Identity is derived, never supplied.** The tenant comes from the verified token. The only client-supplied identifier is `accountId`, which is checked against the token, never trusted.
2. **Every query repeats the scope, and the types force it.** Repository methods take a `TenantScope`, so calling the data layer without one does not compile. Queries use `select`, never `SELECT *`, so a column added later cannot leak by accident (`snapshot/infrastructure/prisma-snapshot.repository.ts`).
3. **The database refuses on its own.** Row Level Security (`ENABLE` + `FORCE`) on every table with a `broker_id`. The app connects as `arrowfin_app`: not owner, not superuser, no `BYPASSRLS`, `SELECT` only. Each transaction starts with `set_config('app.broker_id', …, true)`, scoped to the transaction so a pooled connection cannot leak the previous tenant. Composite foreign keys make it impossible to store a fill that points at another broker's account.

**If someone forgets `WHERE broker_id = ?` six months from now, what catches it?** I did not guess; I broke the code on purpose:

| Mutation | Result |
| --- | --- |
| Remove `brokerId` and `traderId` from the account lookup | Cross-tenant tests still pass (RLS returns nothing), but the *same broker, other trader* test fails. |
| Forget to open the tenant transaction | 37 tests fail, and in production the query returns **zero rows** (fail closed). |
| New table with `broker_id` and no policy | A guardrail test in `test/db-rls.e2e-spec.ts` fails the build. |

The honest limit: **RLS is per tenant, not per trader.** Isolation between two traders of the same broker rests on the `WHERE traderId` clause and its test, which is a weaker guarantee. Hardening it means adding `app.trader_id` to the policy.

## 3. PII handling

**What I treated as sensitive.** The structured columns of `traders.csv` (name, email, phone, date of birth, `ssn_last4`, address), account balances, and above all the free-text `notes` and `audit_notes`: they hold bank details, national ID numbers, paths to KYC documents and compliance case numbers. Free text is the dangerous kind because nobody sanitises it.

**Main decision: minimisation.** The seed loader keeps only `id, broker_id, kyc_status, created_at` from `traders.csv` and drops `api_key_hash` from `brokers.csv`. Data we never store cannot leak or be logged. A test asserts those columns do not exist, and the CSVs committed in `dataset/` are sanitised the same way.

| Surface | Contains | Deliberately excludes |
| --- | --- | --- |
| Database | ids, KYC status, account number, balance, fills | names, contact data, DOB, SSN, address, free-text notes |
| REST response / WebSocket event (same shape) | positions, P&L, risk score, masked account number (`••••0001`) | **balance**, full account number, identity data |
| Logs | method, route template, status, duration, trader and broker ids | bodies, query strings, payloads, headers, tokens |
| Browser | snapshot in memory; token in `sessionStorage` (demo) | nothing cached (`Cache-Control: no-store`) |

**Logged vs redacted.** I log pseudonymous ids and the route template (not the raw URL, so attacker-controlled text cannot forge log lines). I "redact" by not logging payloads at all, which is sturdier than a regex over free text.

**Database vs WebSocket.** In the database PII is a data-at-rest problem: RLS scopes it, the role is read-only, and in production I would add column encryption (KMS), encrypted backups and retention rules. Over the WebSocket it is irrevocable: once a frame reaches a browser I cannot recall it. So the socket carries the minimum (the same allow-listed snapshot, without balance), requires `wss` in production, is bound to an expiring credential and cannot be addressed to a room the server did not choose.

## 4. A vulnerability I did not introduce: BOLA / IDOR on `accountId`

This is the bug in the pull request of Task 4 and the default way a multi-tenant API leaks: the client names an object, the server fetches it, and nobody asks whether *this caller* may see it. The line that prevents it, in `prisma-snapshot.repository.ts`:

```ts
where: { id: accountId, brokerId: scope.brokerId, traderId: scope.traderId }
```

As the attacker (a trader of one broker who guesses another's sequential ids):

| Attack | Why it fails |
| --- | --- |
| `GET /v1/me/snapshot?accountId=ACC-1001` (another broker's account) | The lookup includes my broker and trader: not mine, not found. |
| Tell "exists but not yours" from "does not exist" | Both return the identical `404` (tested): no existence oracle. |
| `?brokerId=…&traderId=…` | `forbidNonWhitelisted`: a 400, the parameters are never read. |
| Forged or downgraded token | `alg:none`, wrong secret, wrong audience, no `exp` and malformed claims are all tested 401s. |
| Injection or log forging through `accountId` | `^ACC-\d{1,10}$` is validated before the value reaches a query or a log. |

**The dev simulator cannot run in production** (required by `simulate-fills.md`), through four independent guards: (1) `DevModule` (`POST /dev/fills`) is imported only if `ENABLE_DEV_ENDPOINTS=true` **and** `NODE_ENV !== 'production'`, otherwise the routes do not exist; (2) `loadConfig()` refuses to boot if both are set (unit-tested); (3) the endpoint needs its own `x-dev-key`, compared in constant time, and a user JWT does not work; (4) it writes through a separate privileged database connection created only inside that module, so the production API never holds credentials that can write.

## 5. What I would do in production but did not

**Rate limiting** per IP and per trader, a cap on concurrent sockets per trader and a login throttle. **Audit logging**: an append-only record of who read which account and when, stored where the app cannot edit it. **Structured redaction**: a logger with a field allow-list and a CI check that fails if a payload is logged. **Encryption**: KMS envelope encryption for balances and any future PII column, TLS everywhere (`wss`, `verify-full` to the database), and secrets from a manager with rotation. **Tokens**: asymmetric signing with the identity provider's JWKS instead of a shared HS256 secret, short-lived access tokens with refresh tokens in an httpOnly cookie behind a BFF (today's `sessionStorage` is a demo trade-off readable by any XSS), and a deny-list so a suspended trader stops working immediately. **Frontend**: a CSP with nonces (today `script-src` needs `'unsafe-inline'` for Next's bootstrap). **Scale**: the Redis adapter for Socket.IO. **Process**: dependency and secret scanning in CI, a penetration test of the tenant boundary, and an incident runbook that treats "a fill reached the wrong tenant" as a reportable event.
