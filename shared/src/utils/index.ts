export function isBeforeStartTime(startAt: string, now: Date = new Date()): boolean {
  return now.getTime() < new Date(startAt).getTime();
}
