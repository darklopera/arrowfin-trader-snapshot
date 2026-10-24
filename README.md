# ArrowFin: Trader Daily Snapshot

> **Time spent:** about 2 hours.
> **LLM use:** yes. I worked together with Claude (Claude Code): I set the scope and approved the approach as the architect; Claude handled the implementation (code, tests, verification and writing support).
> Details, and what I would change if I had written it myself, are in [AI use](#ai-use) below.

Open positions, day P&L and a risk indicator for one trader, updating in real time over a tenant-scoped WebSocket.
NestJS + Prisma + PostgreSQL on the back, Next.js 15 + Tailwind + TanStack Query on the front.

Also in this repo: [`SECURITY.md`](./SECURITY.md) (Task 3) and [`CODE_REVIEW.md`](./CODE_REVIEW.md) (Task 4). Task 5 is at the bottom of this file.
A Spanish version of every document is next to the English one (`*.es.md`).

---

## Background

**Stack ratings** (1 never used, 2 tutorial-level, 3 shipped code with it, 4 comfortable in production, 5 could teach it)

- TypeScript: 4
- Next.js: 4
- NestJS: 2
- Prisma: 2
- PostgreSQL: 4
- WebSockets: 3
- Tailwind: 2
- JWT/auth: 4
- Multi-tenant data isolation: 2
- TanStack Query: 2
- Hexagonal / Clean Architecture: 4
- Redis: 5

**1. What part of our stack are you strongest with?**
My strongest area is architecture. I feel comfortable deciding how a system should be organized: keeping the domain separate from technical details, applying hexagonal and clean architecture, and building modular implementations that other people can understand and maintain. I rely on PostgreSQL, TypeScript, Next.js and a solid knowledge of JWT authentication. I am also used to integrating many different sources, such as web services, databases and external systems, so that they work together as one product.

**2. What part would be the steepest learning curve?**
Probably NestJS and Prisma, with their own ways of doing things, and taking multi-tenant isolation down to the data layer, for example with row-level security in the database. I understand the concepts and why they matter, but I have not taken them to production yet. To shorten the learning curve, I use what I already know well, like architecture and SQL, and I learn the rest by building and reviewing each decision.

**3. Any tech not in our stack you consider a core strength?**
Yes. I have a lot of experience designing REST APIs and integrating web services, including working with API Management tools. I am also strong with Docker and CI/CD, and I work with SQL Server and Azure DevOps. This background helps me connect different systems and take code to production in an organized and repeatable way, not only write it.

**4. What kind of work do you most want to do day-to-day?**
I like designing architectures and technically leading a team, on projects with integrations and systems that need rigor and have real technical challenges. What motivates me most is seeing a real impact from what we build: something that helps the community and the company's customers, not just a good design on paper.

**5. What do you most want to avoid?**
I enjoy technology, and I like challenges and new problems, so that is not what I want to avoid. What I prefer to keep out of my work environment is a lack of communication and respect between people. I believe a team with good communication and respectful treatment can solve almost any technical problem, and a team without them struggles even with simple ones.

---

## AI use

I worked on this assessment together with Claude. First, we analysed the brief until we understood the challenge, the use cases and what each task evaluates. From there, as the architect, I set the direction: I defined the scope and what to leave out, and I reviewed and approved the approach (hexagonal architecture, tenant isolation, personal data handling and the testing strategy), aiming for a solution that is high quality, secure and covers every use case in the assessment. Claude proposed alternatives and handled the implementation phase: it wrote the code and tests, checked that everything worked, validated the results against an independent implementation, and helped me write the texts and reports. I reviewed every piece, and the answers in the Background section come from my ideas and were approved by me.

**How the work was checked:** the numbers are validated against an independent re-implementation in Python (`api/scripts/oracle.py`) run on the raw CSVs; the security tests run against a real PostgreSQL, not a mock; and the code was broken on purpose to see which layer catches what (see [SECURITY.md](./SECURITY.md#2-tenant-isolation)). The UI was exercised in a real browser (login, live fill, server killed and restored, empty and zero-balance accounts, mobile width).

**What I would change if I had written it by hand** (the honest list):

1. **Migrations.** Prisma's engine downloads were blocked in the sandbox where the code was generated, so the SQL in `api/prisma/migrations/` was written by hand (it follows Prisma's naming) and applied with `psql`. On a normal machine I would regenerate it with `prisma migrate diff` and check there is no drift.
2. **P&L method.** Claude picked average-cost accounting. I would confirm with the trading/risk team whether the platform uses FIFO before trusting any number.
3. **NestJS idioms.** I rate myself 2 on NestJS. The module layout, guards and the custom `IoAdapter` came from Claude; I can explain every file, but a NestJS expert might structure some of it differently.
4. **UI.** The visual design is generated. I would align it with your design system.
5. **Prisma driver.** The sandbox could not download Prisma's Rust engine, so the client uses the engine-less mode (`engineType = "client"` with the `pg` adapter). It works everywhere, but I would test it against your production setup before adopting it.

---

## Run it

Needs Node 20+. Postgres via Docker **or** without it.

```bash
# 1. Database: pick ONE
docker compose up -d db              # Postgres 16 on :54329, creates the read-only role
#   or, no Docker:
cd api && npm install && npm run db:embedded     # leave it running; it migrates + seeds by itself

# 2. API  (new terminal)
cd api
cp .env.example .env                 # edit secrets if you like
npm install
npm run db:generate
npm run db:migrate && npm run db:seed    # Docker path only; the embedded path already did both
npm run build && npm run start       # http://localhost:4000

# 3. Web  (new terminal)
cd web
cp .env.example .env.local
npm install && npm run dev           # http://localhost:3000
```

Open http://localhost:3000 and pick an identity. The dataset has no passwords, so this screen stands in for each broker's own sign-in (dev only, see SECURITY.md).

| Sign in as | What you see |
| --- | --- |
| **T-005** (Summit) | two accounts; ACC-1006 is at **94% risk**, so the high-risk state |
| **T-011** (Meridian) | no trading activity: empty state |
| **T-010** (Meridian) | zero balance with an open position: risk 100, no divide-by-zero |
| **T-001** (Retail) | a different tenant with its own data |

**Simulate a live fill** while the page is open (option 1 of `simulate-fills.md`):

```bash
curl -X POST localhost:4000/dev/fills \
  -H 'content-type: application/json' -H 'x-dev-key: <DEV_API_KEY from .env>' \
  -d '{"account_id":"ACC-1006","instrument_symbol":"MES","side":"BUY","quantity":2,"price":5643.25,"commission_usd":1.40}'
```

Then kill the API: the page marks every figure **STALE** within about 15 s. Start it again: it reconnects and catches up.

**Tests**

```bash
cd api && npm run test:unit   # 31 tests, ~2 s, no database
cd api && npm run test:e2e    # 65 tests against a real PostgreSQL (embedded, started by the tests)
cd web && npm test            # pure client logic
```

`npm run test:e2e` is the spec of the security model: cross-tenant and cross-trader access, forged tokens, WebSocket scoping, RLS behaviour, and the correctness of all 18 accounts against the Python oracle.

---

## How it is built

```
Browser (Next.js)                         API (NestJS, hexagonal)                      PostgreSQL
─────────────────                         ───────────────────────                      ──────────
REST  GET /v1/me/snapshot  ──Bearer JWT──▶ JwtAuthGuard ─▶ TenantScope{broker,trader}
                                          SnapshotController                           role arrowfin_app:
WS    socket.io (auth:{token}) ─handshake─▶ FillsGateway.use(verify JWT,               SELECT only, RLS ON,
       no inbound messages exist           join server-chosen rooms)                   NOBYPASSRLS
                                          GetSnapshotUseCase                           set_config('app.broker_id')
                                            ├─ SnapshotRepositoryPort ─▶ PrismaSnapshotRepository ─▶ withTenant(tx)
                                            └─ computeSnapshot()   ← pure function, no I/O
POST /dev/fills (dev only) ─▶ DevFillsService ─▶ insert (privileged conn) ─▶ recompute ─▶ publish to room
```

- **`snapshot/domain`**: `computeSnapshot()` is a pure function (fills, instruments, marks, balance, session start in; positions, P&L, risk out). REST and WebSocket both go through it, so they cannot disagree. This is where the financial rules live and where most unit tests are.
- **`snapshot/application`**: the use case and the ports (`SnapshotRepositoryPort`, `SnapshotPublisherPort`, `Clock`).
- **`snapshot/infrastructure`**: the Prisma adapter. Every method takes a `TenantScope`, so "forgot the tenant" does not compile.
- **`realtime`**: the Socket.IO gateway. **`dev`**: simulator and demo login, only loaded in development.

### Task 1: data and index

`fills` carries a denormalised `broker_id`, with **composite foreign keys** `(account_id, broker_id) → accounts(id, broker_id)`. Two payoffs: the RLS policy is a trivial `broker_id = current_setting(...)` with no join, and the database itself refuses a fill that points at another broker's account (tested).

**The index I can explain:** `fills(account_id, filled_at, id)`. The hot query is "all fills of one account, in time order". Equality on `account_id`, then `filled_at, id` already sorted, so Postgres does an index range scan with no sort step. `broker_id` is not in the index on purpose: `account_id` is already selective and RLS adds `broker_id` as a cheap filter on the few rows that match. Putting `broker_id` first would only help queries that no endpoint runs, so I left it out (I reasoned about this; I did not benchmark it).

**Financial rules that are easy to get wrong** (each has a test):

- **Contract size:** value = price × quantity × `point_value_usd` (MES 5, ES 50, 6E 125,000). `decimal.js` for all money.
- **A session is not a calendar day:** CME opens 17:00 US Central. "Today" for the dataset cut is the session that began 2026-08-24 17:00 CDT (22:00 UTC). Computed in `America/Chicago` so daylight saving is right; weekends roll back to Thursday's session. Exchange holidays are not modelled.
- **Positions carry over:** open positions come from all fills, day P&L only from fills in the current session.
- **Commissions** are subtracted from realized P&L. **Partial fills** of one `order_id` are one order (counted once in the activity line).
- **Unrealized** is open P&L versus average entry, because the dataset has no prior-session settlement price.
- **Risk** = `min(100, gross notional / balance × 100)`. A zero or negative balance with exposure scores 100; with no exposure, 0. Never NaN or Infinity.
- **Not every account is active:** closed and restricted accounts are readable and say so. An account with no fills returns an empty, valid snapshot.

### Task 2: reconnect behaviour (the question in the assessment)

Our feed drops. How does the client know it missed fills, and what does it do?

1. **It does not try to know.** Every pushed event is the **full snapshot** plus a per-account `version` (the number of fills applied). State, not deltas. A duplicate or late event has `version <=` what we show and is ignored. A newer event after a gap is applied directly: it already contains everything the missed events would have added, so a gap heals itself.
2. **On every connect, including reconnects, the client refetches the snapshot over REST.** That covers the case where no further event ever arrives (the market goes quiet right after the outage) and also the race on the very first connect, where a fill can land between the REST response and the socket joining its room.
3. **While the socket is not connected, nothing is shown as live.** The connection badge changes, a **STALE** banner appears with the time of the last live update, and every figure is dimmed and tagged STALE. socket.io pings every 10 s (5 s timeout), so a silently dead connection is detected in about 15 s, not "eventually".
4. **Reconnects use exponential backoff with jitter** (1 s to 15 s, ±50%) so a feed outage does not become a thundering herd when it ends.
5. **The server closes the socket when the JWT expires.** The client renews its token 60 s before expiry, and if it is refused anyway it renews and reconnects.

I tested this in a browser: kill the API, the page goes STALE; insert a fill straight into the database while it is down; restart the API, and the page comes back live **with the fill that happened during the outage**.

**If your implementation would silently show stale numbers, say so:** there is one honest gap. Between a connection dying and socket.io noticing (up to ~15 s) the page still says Live. A tighter bound needs an application-level heartbeat from the server with a freshness timestamp, which I did not build.

### What I cut, and why

- **Recomputing from the full fill history on every fill.** Fine for this dataset; it is O(fills of that account) per event and will not survive production volumes (see Task 5).
- **Redis adapter for Socket.IO.** One API instance only. With two instances a fill published on one never reaches sockets on the other. I know the fix (the adapter plus the same room names); I did not build it.
- **A real identity provider.** The dataset has no credentials, so there is a dev login. Token renewal is a stand-in for a refresh-token flow.
- **Rate limiting, audit log, structured log redaction:** listed with specifics in SECURITY.md, section 5.
- **Frontend tests are limited to pure logic.** The behaviour was checked by hand in a real browser, not by committed UI tests.

---

## Task 5: architecture and handoff

**The decision I am most proud of, and what it cost.** I made tenant isolation structural instead of a matter of discipline. The tenant exists in one place, the verified token; every repository method needs it in its signature; the queries repeat it in their `WHERE`; and the database independently refuses to return another tenant's rows (row level security that fails closed, a read-only application role, composite foreign keys). A fill reaching the wrong tenant would need three separate mistakes, and each layer has its own test. The cost: an extra round trip per request to set the tenant, `broker_id` duplicated across tables, a second database role for local setup, and tests that need a real PostgreSQL. It is also not total: RLS is per tenant, so isolation between two traders of the same broker still rests on the `WHERE` clause. I broke it on purpose and a test caught it, but it is a weaker guarantee and I prefer to say so.

**The one thing I would change with a second day.** Stop recomputing the snapshot from the whole fill history on every event. I would keep a `positions` table per account, updated in the same transaction that stores the fill, and build the snapshot from it plus the market prices. The cost per fill becomes constant, the `version` gets a natural home, and ingestion could later run as a separate service. Right after that: the Redis adapter for Socket.IO, and the token moved from `sessionStorage` to an httpOnly cookie behind a small BFF.

**If I handed this repo to two engineers tomorrow.** First I would tell them to run `npm run test:e2e`: the tests are the specification of the security model, and `SECURITY.md` explains why each rule exists. I would ask them not to change five things without a written discussion: (1) a `TenantScope` is only created from a verified token, never from a parameter, body or header; (2) tenant data is only read through `withTenant`, and the app database role stays read-only, non-owner and without `BYPASSRLS`; (3) every new table with a `broker_id` ships with its RLS policy in the same PR (a guardrail test enforces it); (4) the WebSocket gateway keeps having no inbound handlers and no client-chosen rooms; (5) API responses are explicit allow-lists and payloads are never logged. Everything else, from the UI to the P&L method, is theirs to improve, and I would ask them to review each other's pull requests with one question: "who is asking, and how do we know?"
