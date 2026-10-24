# Code review (Task 4)

*Written the way I would leave it on the pull request.*

```ts
@Get('positions/:accountId')
async getPositions(@Param('accountId') accountId: string, @Req() req) {
  const positions = await this.prisma.position.findMany({ where: { accountId } });
  this.logger.log(`positions for ${accountId}: ${JSON.stringify(positions)}`);
  return positions.map(p => ({ ...p, pnl: (p.markPrice - p.avgPrice) * p.qty }));
}
```

---

**Verdict: request changes. I would not merge this, and I would not deploy it even behind a flag until the first point is fixed.**

Thanks for the PR. The endpoint is easy to read, and the shape (fetch, map, return) is the right starting point. Three things in it can leak customer data, so they need to change before it ships. I would fix them together and I am happy to pair on it. None of it is about style.

### Block: must change before merge

**1. Any logged-in user can read anyone's positions (IDOR / broken object-level authorization). Fix this first.**
`accountId` comes from the URL and goes straight into the query. Nothing checks that the account belongs to the caller: `req` is injected and never used, so the identity of the user is ignored. Account ids look sequential (`ACC-1001`, `ACC-1002`…), so a trader of any broker can walk them and read every other tenant's positions. Our own rule is that cross-tenant access is a P0, and this is exactly that. A class-level auth guard would only prove "somebody is logged in", not "this person may see this account".
*Fix:* take the tenant and trader from the verified token, never from the request; query with `where: { accountId, account: { brokerId, traderId } }` inside our `withTenant()` helper so RLS applies as well; return the same `404` for "not yours" and "does not exist" so ids cannot be enumerated; validate the param (`^ACC-\d+$`). **Add a test that a trader of broker A asking for an account of broker B gets 404**, and one for another trader of the same broker. That test is the real deliverable of this fix.

**2. It writes customers' financial positions to the logs.**
`JSON.stringify(positions)` at `log` level puts regulated account data in log storage, which has different access controls, longer retention and more readers than the database. `${accountId}` is also user-controlled text going into a log line, so a value with a line break can forge entries (log injection). If this has already run anywhere with real data, treat it as a possible data exposure and ask security whether it is reportable.
*Fix:* log identifiers, never payloads: request id, trader id, count of positions. If someone really needs the payload to debug, that is a local, temporary change that does not get committed.

**3. `...p` returns every column of the table.**
The response is whatever the table holds: internal ids, `brokerId`, and any column somebody adds later, automatically and silently. The API contract should be an allow-list.
*Fix:* a response DTO with explicit fields (and a Prisma `select`, so unneeded columns are not even read).

### Fix before this feeds anything a customer sees (I would accept a follow-up ticket only if the field is hidden until then)

**4. The P&L number looks right and is wrong.** `(markPrice - avgPrice) * qty` ignores the contract multiplier: for the same one-point move an `ES` position is worth 10× a `MES`, and `6E` is 125,000 per unit. It also ignores commissions, and uses binary floats for money. It will be wrong by a factor of 5 to 50 depending on the instrument, with no error to warn anyone, which is the worst kind of bug in a trading product. `markPrice` read from a stored row may also be stale. *Fix:* reuse the existing snapshot calculator (pure function, already tested against an independent implementation) instead of recomputing in a controller.

### Comment: not blocking, would like to see

- **Layering.** The controller talks to Prisma directly. Put the query behind a repository/port and the maths in the domain function, so the controller only maps HTTP to a use case. It also makes the missing test above easy to write.
- **Unbounded query.** `findMany` with no limit or pagination: one account with a long history returns everything.
- **Types.** `@Req() req` is `any`. A `@CurrentScope()` param decorator gives a typed, non-forgeable tenant scope and makes #1 hard to repeat.
- **No tests.** I would not approve any endpoint that returns customer data without at least the cross-tenant test.
- **Empty list vs 404.** Returning `[]` for an account that does not exist tells the caller nothing wrong, but keep it consistent with the 404 rule from #1.

### What I would do first

**#1, today, on its own.** It is exploitable right now by any authenticated user, it crosses tenants, and the fix is small. If this endpoint is already live, I would ship #1 (and remove the log line from #2) as a hotfix before anything else in this PR, and then do #3 and #4 properly. Everything else can wait for the next review.

### How I would say it to the author

I would send the comment above, then message them directly: *"The first two are classic ones, and they are easy to miss because the code works perfectly in the happy path. Want to take ten minutes together so we write the cross-tenant test first and watch it fail on the current code?"* The goal is that next time they ask "who is calling this, and how do I know?" before writing the query, not that they feel reviewed.
