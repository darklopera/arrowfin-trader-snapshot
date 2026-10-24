"""Independent re-implementation of the snapshot maths straight from the raw CSVs
(Python + Decimal, different code path from the TypeScript calculator). Its output
is the fixture the e2e tests compare the API against, so a bug in one
implementation cannot hide in both."""
import csv, json, sys
from decimal import Decimal as D
from datetime import datetime, timezone
d = sys.argv[1]
rd = lambda f: list(csv.DictReader(open(f'{d}/{f}')))
pv = {r['symbol']: D(r['point_value_usd']) for r in rd('instruments.csv')}
mk = {r['symbol']: D(r['mark_price']) for r in rd('market_prices.csv')}
bal = {r['id']: D(r['balance']) for r in rd('accounts.csv')}
SESSION = datetime(2026, 8, 24, 22, 0, tzinfo=timezone.utc)  # 17:00 CDT
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))
by = {a: [] for a in bal}
for r in rd('fills.csv'): by[r['account_id']].append(r)
out = {}
for acc, fl in by.items():
    fl.sort(key=lambda r: (ts(r['filled_at']), r['id']))
    pos = {}; real = D(0); comm = D(0); n = 0; orders = set()
    for r in fl:
        s = r['instrument_symbol']; q = int(r['quantity']) * (1 if r['side'] == 'BUY' else -1); p = D(r['price'])
        qty, avg = pos.get(s, (0, D(0)))
        today = ts(r['filled_at']) >= SESSION
        if today: comm += D(r['commission_usd']); n += 1; orders.add(r['order_id'])
        # walk unit by unit: simple and obviously correct
        for _ in range(abs(q)):
            u = 1 if q > 0 else -1
            if qty == 0 or (qty > 0) == (u > 0):
                avg = (avg * abs(qty) + p) / (abs(qty) + 1); qty += u
            else:
                if today: real += (p - avg) * (1 if qty > 0 else -1) * pv[s]
                qty += u
                if qty == 0: avg = D(0)
                elif (qty > 0) != (u < 0): avg = p
        pos[s] = (qty, avg)
    unreal = D(0); gross = D(0); open_ = {}
    for s, (qty, avg) in pos.items():
        if qty == 0: continue
        unreal += (mk[s] - avg) * qty * pv[s]; gross += abs(qty) * mk[s] * pv[s]; open_[s] = qty
    score = (D(100) if gross > 0 else D(0)) if bal[acc] <= 0 else min(D(100), gross / bal[acc] * 100)
    out[acc] = dict(positions=open_, realizedGross=float(round(real, 2)), commissions=float(round(comm, 2)),
                    unrealized=float(round(unreal, 2)), gross=float(round(gross, 2)), score=float(round(score, 1)),
                    fillsToday=n, ordersToday=len(orders), fills=len(fl))
json.dump(out, open(sys.argv[2], 'w'), indent=1, sort_keys=True)
print(json.dumps({k: (v['realizedGross'], v['unrealized'], v['score'], v['positions']) for k, v in out.items()}, indent=0)[:2500])
