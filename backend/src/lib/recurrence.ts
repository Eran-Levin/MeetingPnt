import type { RecurrenceRuleDto } from '@meetingpnt/shared';

const MAX_OCCURRENCES = 52;
const MAX_DAYS_SCANNED = 366;

/**
 * Generates occurrence dates for a weekly recurrence rule. The first occurrence is always
 * `firstStartAt` itself (if its weekday is included); later occurrences repeat on the given
 * weekdays at the same time-of-day, until `count` occurrences exist or `until` is reached.
 */
export function generateOccurrenceDates(firstStartAt: Date, rule: RecurrenceRuleDto): Date[] {
  const hours = firstStartAt.getHours();
  const minutes = firstStartAt.getMinutes();
  const untilDate = rule.endType === 'until' && rule.until ? new Date(rule.until) : null;
  const maxCount = rule.endType === 'count' && rule.count ? rule.count : MAX_OCCURRENCES;

  const dates: Date[] = [];
  const cursor = new Date(firstStartAt);
  cursor.setHours(0, 0, 0, 0);

  for (let scanned = 0; scanned < MAX_DAYS_SCANNED && dates.length < maxCount; scanned++) {
    if (rule.daysOfWeek.includes(cursor.getDay())) {
      const occurrence = new Date(cursor);
      occurrence.setHours(hours, minutes, 0, 0);

      if (occurrence >= firstStartAt) {
        if (untilDate && occurrence > untilDate) break;
        dates.push(occurrence);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}
