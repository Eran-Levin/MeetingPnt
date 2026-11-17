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
const multiDayUid = (id: string) => `multiday-${id}`;

interface Recipient {
  email: string;
  name: string;
  locale: Locale;
}

/** `example.com` is reserved for examples and can never receive mail — and it is where every
 * seeded account lives. Writing to them would only bounce, and bounces count against the sender. */
const isUndeliverable = (email: string) => email.toLowerCase().endsWith('@example.com');

/**
 * Everyone whose calendar the event belongs on: the leader, the roster, and visitors to this one
 * event. Left out: placeholders — a roster slot for someone with no account has no real address —
 * and addresses that can't receive mail.
 */
async function recipientsOf(groupId: string, activityId?: string) {
  const [group, guests] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        leader: true,
        members: { where: { status: 'active' }, include: { user: true } },
      },
    }),
    // Visitors belong to one event; a multi-day event has none of its own.
    activityId
      ? prisma.activityGuest.findMany({ where: { activityId }, include: { user: true } })
      : Promise.resolve([]),
  ]);

  const people = new Map<string, Recipient>();
  for (const user of [
    group.leader,
    ...group.members.map((m) => m.user),
    ...guests.map((g) => g.user),
  ]) {
    if (user.isPlaceholder || isUndeliverable(user.email)) continue;
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
): Promise<{ count: number; send: () => void }> {
  const { group, recipients } = await recipientsOf(activity.groupId, activity.id);
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

  const moreStarts = seriesStarts?.filter((s) => s.getTime() !== activity.startAt.getTime());
  return compose({
    change,
    event,
    group,
    recipients,
    dates: seriesStarts?.length ?? 1,
    askReply: activity.requiresRsvp,
    moreStarts,
    // A change to one date of a series names it by the start it was invited with.
    instanceStart: seriesStarts ? undefined : (activity.invitedInstanceStart ?? undefined),
    logId: activity.id,
  });
}

/**
 * The emails for one change, and the function that sends them. Shared by single events and
 * multi-day ones, which differ only in the entry they describe.
 */
function compose(args: {
  change: CalendarChange;
  event: CalendarEvent;
  group: Awaited<ReturnType<typeof recipientsOf>>['group'];
  recipients: Recipient[];
  dates: number;
  askReply: boolean;
  moreStarts?: Date[];
  instanceStart?: Date;
  logId: string;
}): { count: number; send: () => void } {
  const { change, event, group, recipients } = args;
  const leader = displayName(group.leader);
  const sequence = sequenceNow();

  const emails = recipients.map((recipient) => ({
    to: recipient.email,
    ...buildEmail(
      change,
      recipient.locale,
      { leader, group: group.name, title: event.title },
      {
        dates: args.dates,
        // The leader isn't asked whether they're coming to their own event.
        askReply: change === 'invited' && args.askReply && recipient.email !== group.leader.email,
      },
    ),
    method: change === 'cancelled' ? ('cancel' as const) : ('request' as const),
    ics: buildIcsInvitation({
      method: change === 'cancelled' ? 'cancel' : 'request',
      event,
      sequence,
      organizer: { name: leader, email: senderAddress },
      attendee: { name: recipient.name, email: recipient.email },
      moreStarts: args.moreStarts,
      instanceStart: args.instanceStart,
    }),
  }));

  const send = () => {
    void (async () => {
      for (const email of emails) {
        try {
          await sendCalendarEmail(email);
        } catch (error) {
          console.error(`[calendar] invitation to one recipient failed (${args.logId})`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
      }
    })();
  };
  return { count: emails.length, send };
}

/**
 * A multi-day event goes onto calendars as ONE entry spanning its days, with the days listed in
 * the description — not an email per day. The days themselves are left out of the per-event
 * invitations (see `multiDayEventId` in the activities service).
 */
export async function prepareMultiDayInvitations(
  change: CalendarChange,
  multiDayEventId: string,
): Promise<{ count: number; send: () => void }> {
  const multiDay = await prisma.multiDayEvent.findUniqueOrThrow({
    where: { id: multiDayEventId },
    include: { days: { orderBy: { startAt: 'asc' } } },
  });
  // Drafts are the leader's private planning space: a day not yet published stays off the entry.
  const days = multiDay.days.filter((day) => day.status !== 'draft');
  if (days.length === 0) return { count: 0, send: () => {} };

  const { group, recipients } = await recipientsOf(multiDay.groupId);
  const agenda = days.map((day, index) => `${index + 1}. ${day.title}`).join('\n');
  const event: CalendarEvent = {
    uid: multiDayUid(multiDay.id),
    title: multiDay.title,
    description: [group.name, multiDay.description, agenda].filter(Boolean).join('\n\n'),
    startAt: days[0]!.startAt,
    endAt: days[days.length - 1]!.endAt,
    allDay: true,
  };
  return compose({
    change,
    event,
    group,
    recipients,
    dates: 1,
    askReply: days.some((day) => day.requiresRsvp),
    logId: multiDay.id,
  });
}

/** Prepare and send a multi-day event's invitation, never throwing. */
export async function announceMultiDayChange(
  change: CalendarChange,
  multiDayEventId: string,
): Promise<number> {
  try {
    const { count, send } = await prepareMultiDayInvitations(change, multiDayEventId);
    send();
    return count;
  } catch (error) {
    console.error(`[calendar] could not prepare multi-day invitations (${multiDayEventId})`, error);
    return 0;
  }
}

/** Prepare and send, never throwing — for the callers that have nothing to do in between.
 * Returns how many people an invitation is going to, so the leader can be told. */
export async function announceCalendarChange(
  change: CalendarChange,
  activity: Activity,
  seriesStarts?: Date[],
): Promise<number> {
  try {
    const { count, send } = await prepareCalendarInvitations(change, activity, seriesStarts);
    send();
    return count;
  } catch (error) {
    console.error(`[calendar] could not prepare invitations (${activity.id})`, error);
    return 0;
  }
}
