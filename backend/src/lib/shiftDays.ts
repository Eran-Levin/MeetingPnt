import { isValidTimeZone, shiftDays } from '@meetingpnt/shared';

// The implementation lives in shared so the clients can read a wall clock the same way the server does.
export { shiftDays };

/** Throws RangeError for a zone name Intl doesn't know. */
export function assertTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Invalid time zone: ${timeZone}`);
}
