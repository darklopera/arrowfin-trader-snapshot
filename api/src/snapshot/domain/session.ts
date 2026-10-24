import { DateTime } from 'luxon';

const EXCHANGE_TZ = 'America/Chicago';

/**
 * CME Globex trading day: opens 17:00 US Central, runs to 16:00 the next
 * afternoon. One session therefore spans TWO UTC dates, so "today" can never be
 * `DATE(filled_at)`. We return the UTC instant at which the current session
 * started, DST-correct because Luxon works in the exchange's wall-clock zone.
 *
 * Weekends: the market is closed from Friday 16:00 CT to Sunday 17:00 CT. If the
 * naive start lands on Friday or Saturday evening, the latest real session is the
 * one that opened Thursday 17:00 CT. Exchange holidays are NOT modelled (cut).
 */
export function currentSessionStart(now: Date): Date {
  const local = DateTime.fromJSDate(now, { zone: EXCHANGE_TZ });
  let start = local.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  if (local < start) start = start.minus({ days: 1 });
  // luxon weekday: 1=Mon ... 5=Fri, 6=Sat, 7=Sun
  if (start.weekday === 5 || start.weekday === 6) {
    start = start.minus({ days: start.weekday - 4 }); // back to Thursday
  }
  return start.toUTC().toJSDate();
}
