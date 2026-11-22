
/** Signed whole days from `from` to `to` (`YYYY-MM-DD`); 0 when either is missing. Measured at
 * noon, so a daylight-saving change in between can't push the count off by one. */
export function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000,
  );
}

/** `YYYY-MM-DD` plus a number of calendar days, in the browser's own time zone. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
