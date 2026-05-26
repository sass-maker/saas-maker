// Fleet changelog groups entries by local calendar day in Asia/Kolkata (IST, UTC+5:30).
// Agents often commit late at UTC night (e.g. 23:30 UTC = 05:00 IST next morning),
// so the fleet view must bucket those entries under the IST date they belong to —
// not the UTC date. A bare date(created_at) comparison would silently hide them.
// Pass an explicit `now` ms timestamp for unit-testing without mocking Date.now().
export function getFleetToday(now = Date.now()): string {
  const localNow = new Date(now + 5.5 * 60 * 60 * 1000);
  return localNow.toISOString().slice(0, 10);
}
