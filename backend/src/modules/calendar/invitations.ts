import {
  buildIcsInvitation,
  emailText,
  isRtlLocale,
  isolate,
  type CalendarEvent,
  type Locale,
} from '@meetingpnt/shared';
import type { Activity } from '@prisma/client';
import { listFirstMeetingPoints } from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { bdi, senderAddress, sendCalendarEmail } from '../../lib/resendClient.js';
import { displayName, toLocale } from '../../lib/userName.js';

/**
 * Calendar invitations by email: publishing an event puts it on everyone's calendar, and a later
 * change or removal follows it there.
 *
 * Each person gets their own email carrying an invitation file (`buildIcsInvitation`). The sender
 * is MeetingPnt with the leader's name on it — sending as the leader's own address would need
 * access to their mail account. Nothing here may fail the action that triggered it: an event is
 * published whether or not an email went out, so everything is prepared, then sent in the
 * background, and errors are logged.
 */

export type CalendarChange = 'invited' | 'updated' | 'cancelled';

/** Resend's default limit is two requests a second. */
const SEND_GAP_MS = 600;

/**
 * A calendar only accepts a change that is newer than what it holds, judged by this number. The
 * clock gives one that always grows without a counter to store: seconds since the start of 2026.
 */
function sequenceNow(): number {
  return Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000);
}

/** One repeating entry per series; an event published on its own goes under its own id. */
const seriesUid = (seriesId: string) => `series-${seriesId}`;

interface Recipient {
  email: string;
  name: string;
  locale: Locale;
}

/**
 * Everyone whose calendar the event belongs on: the leader, the roster, and visitors to this one
 * event. Placeholders are left out — a roster slot for someone with no account has no real address.
 */
async function recipientsOf(activity: Activity) {
  const [group, guests] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: activity.groupId },
      include: {
        leader: true,
        members: { where: { status: 'active' }, include: { user: true } },
      },
    }),
    prisma.activityGuest.findMany({ where: { activityId: activity.id }, include: { user: true } }),
  ]);

  const people = new Map<string, Recipient>();
  for (const user of [
    group.leader,
    ...group.members.map((m) => m.user),
    ...guests.map((g) => g.user),
  ]) {
    if (user.isPlaceholder) continue;
    people.set(user.id, {
      email: user.email,
      name: displayName(user),
      locale: toLocale(user.locale),
    });
  }
  return { group, recipients: [...people.values()] };
}

function buildEmail(
  change: CalendarChange,
  locale: Locale,
  names: { leader: string; group: string; title: string },
  options: { dates: number; askReply: boolean },
) {
  const subject = emailText(
    locale,
    change === 'invited'
      ? 'eventInvitedSubject'
      : change === 'updated'
        ? 'eventUpdatedSubject'
        : 'eventCancelledSubject',
    { title: isolate(names.title) },
  );

  const params = {
    leader: bdi(names.leader),
    group: bdi(names.group),
    title: `<strong>${bdi(names.title)}</strong>`,
  };
  const intro =
    change === 'cancelled'
      ? emailText(locale, 'eventCancelledIntro', params)
      : change === 'updated'
        ? emailText(locale, 'eventUpdatedIntro', params)
        : options.dates > 1
          ? emailText(locale, 'seriesInvitedIntro', { ...params, count: options.dates })
          : emailText(locale, 'eventInvitedIntro', params);

  const html = `
    <div lang="${locale}" dir="${isRtlLocale(locale) ? 'rtl' : 'ltr'}">
      <p>${intro}</p>
      ${options.askReply ? `<p>${emailText(locale, 'eventReplyInApp')}</p>` : ''}
    </div>
  `;
  return { subject, html };
}

/**
 * Works out every email for one change and returns the function that sends them. Split in two
 * because a removal has to read the event and its roster *before* the row is deleted, and send
 * only once it is.
 *
 * `seriesStarts` is given when a whole series is being published: `activity` is then its first
 * date and the rest ride along as repeats of the same entry.
 */
export async function prepareCalendarInvitations(
  change: CalendarChange,
  activity: Activity,
  seriesStarts?: Date[],
): Promise<() => void> {
  const { group, recipients } = await recipientsOf(activity);
  const [start] = await listFirstMeetingPoints([activity.id]);

  const inSeries = activity.seriesId && (seriesStarts || activity.invitedInstanceStart);
  const event: CalendarEvent = {
    uid: inSeries ? seriesUid(activity.seriesId!) : activity.id,
    title: activity.title,
    description: [group.name, activity.description, start?.googleMapsUrl]
      .filter(Boolean)
      .join('\n\n'),
    location: start?.label ?? null,
    startAt: activity.startAt,
    endAt: activity.endAt,
    allDay: activity.allDay,
  };

  const leader = displayName(group.leader);
  const sequence = sequenceNow();
  const moreStarts = seriesStarts?.filter((s) => s.getTime() !== activity.startAt.getTime());

  const emails = recipients.map((recipient) => ({
    to: recipient.email,
    ...buildEmail(
      change,
      recipient.locale,
      { leader, group: group.name, title: activity.title },
      {
        dates: seriesStarts?.length ?? 1,
        // The leader isn't asked whether they're coming to their own event.
        askReply:
          change === 'invited' && activity.requiresRsvp && recipient.email !== group.leader.email,
      },
    ),
    method: change === 'cancelled' ? ('cancel' as const) : ('request' as const),
    ics: buildIcsInvitation({
      method: change === 'cancelled' ? 'cancel' : 'request',
      event,
      sequence,
      organizer: { name: leader, email: senderAddress },
      attendee: { name: recipient.name, email: recipient.email },
      moreStarts,
      // A change to one date of a series names it by the start it was invited with.
      instanceStart: seriesStarts ? undefined : (activity.invitedInstanceStart ?? undefined),
    }),
  }));

  return () => {
    void (async () => {
      for (const email of emails) {
        try {
          await sendCalendarEmail(email);
        } catch (error) {
          console.error(`[calendar] invitation to one recipient failed (${activity.id})`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
      }
    })();
  };
}

/** Prepare and send, never throwing — for the callers that have nothing to do in between. */
export async function announceCalendarChange(
  change: CalendarChange,
  activity: Activity,
  seriesStarts?: Date[],
): Promise<void> {
  try {
    (await prepareCalendarInvitations(change, activity, seriesStarts))();
  } catch (error) {
    console.error(`[calendar] could not prepare invitations (${activity.id})`, error);
  }
}
