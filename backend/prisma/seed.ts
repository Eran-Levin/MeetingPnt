import { createServer } from 'node:http';
import type { CreateActivityDto } from '@meetingpnt/shared';
import { env } from '../src/config/env.js';
import { listMeetingPoints } from '../src/db/geo.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import * as activitiesService from '../src/modules/activities/service.js';
import * as attendanceService from '../src/modules/attendance/service.js';
import * as groupsService from '../src/modules/groups/service.js';
import * as meetingPointsService from '../src/modules/meetingPoints/service.js';
import * as rsvpsService from '../src/modules/rsvps/service.js';
import { createRealtimeServer } from '../src/realtime/index.js';

// createMeetingPoint/sendMessage emit socket events via getIO() — give them a real (unlistened)
// Socket.IO server so those calls don't throw during seeding.
createRealtimeServer(createServer());

const TEST_PASSWORD = 'password123';

function daysFromNow(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** All-day activities span whole days, so their bounds sit at midnight and one second to midnight. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 0);
  return d;
}

/** The most recent occurrence of `dayOfWeek` on/before today, offset by `weeksAgo` more weeks
 * (negative pushes forward, e.g. -1 lands on next week's occurrence instead). */
function weekdayAnchor(dayOfWeek: number, weeksAgo: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  const diff = (date.getDay() - dayOfWeek + 7) % 7;
  date.setDate(date.getDate() - diff - weeksAgo * 7);
  return date;
}

function mapsUrl(lat: number, lng: number): string {
  // toFixed guarantees a decimal fraction — the parser's @lat,lng regex requires one,
  // and whole-number coordinates would otherwise stringify without a "."
  return `https://www.google.com/maps/@${lat.toFixed(4)},${lng.toFixed(4)},17z`;
}

/** Callers pass a full name; the split mirrors what the invite form collects. */
async function ensureUser(email: string, name: string, role: 'admin' | 'leader' | 'user') {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [firstName, ...rest] = name.trim().split(' ');
  return prisma.user.create({
    data: {
      email,
      firstName: firstName!,
      lastName: rest.join(' '),
      phone: seededPhone(email),
      role,
      passwordHash,
    },
  });
}

/** Stable fake numbers so the roster has something to show without being real. */
function seededPhone(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `+972 5${(hash % 10)}-${String(hash % 1000).padStart(3, '0')}-${String(hash % 10000).padStart(4, '0')}`;
}

async function ensureMembership(groupId: string, userId: string) {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, status: 'active' },
    update: { status: 'active' },
  });
}

/** Writes an RSVP straight to the table. Seeded history includes events that have already run,
 * and the service layer rightly refuses a member RSVP once an activity has started. */
async function recordRsvp(activityId: string, userId: string, status: 'approved' | 'declined') {
  await prisma.rsvp.upsert({
    where: { activityId_userId: { activityId, userId } },
    create: { activityId, userId, status, respondedAt: new Date() },
    update: { status, respondedAt: new Date() },
  });
}

async function ensureGuest(activityId: string, userId: string, invitedBy: string) {
  await prisma.activityGuest.upsert({
    where: { activityId_userId: { activityId, userId } },
    create: { activityId, userId, invitedBy },
    update: {},
  });
}

async function ensureGroup(
  leaderId: string,
  name: string,
  description: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.group.findFirst({ where: { leaderId, name } });
  if (existing) return { id: existing.id, created: false };
  const group = await groupsService.createGroup(leaderId, { name, description });
  return { id: group.id, created: true };
}

async function main() {
  // ---- admin ----
  const admin = await ensureUser(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_NAME, 'admin');
  console.log(`[seed] admin ready: ${admin.email}`);

  // ---- shared member pool (~15 people reused across the leaders below) ----
  const memberNames = [
    'Ana Torres',
    'Ben Cohen',
    'Chloe Kim',
    'Daniel Levi',
    'Elena Petrova',
    'Farid Haddad',
    'Grace Wong',
    'Hassan Ali',
    'Ivy Chen',
    'Jonas Weber',
    'Katya Novak',
    "Liam O'Brien",
    'Mira Patel',
    'Noah Schmidt',
    'Olga Ivanova',
  ];
  const members = await Promise.all(
    memberNames.map((name, i) => ensureUser(`member${i + 1}@example.com`, name, 'user')),
  );
  console.log(`[seed] ${members.length} member users ready`);

  // ===================== Photo instructor =====================
  // Sunday-every-4-weeks series with mid-session meeting-point changes and a cross-group visitor.
  const photoLeader = await ensureUser('photoinstructor@example.com', 'Dana Cohen', 'leader');

  const photoGroupA = await ensureGroup(
    photoLeader.id,
    'Sunday Street Photography Walks',
    'Monthly street photography sessions around downtown — bring your own camera.',
  );
  if (photoGroupA.created) {
    const roster = members.slice(0, 10);
    for (const member of roster) await ensureMembership(photoGroupA.id, member.id);

    const dto: CreateActivityDto = {
      title: 'Street Photography Walk',
      description: 'Bring your camera and comfortable shoes — we cover a few miles.',
      // Anchored to the most recent Sunday, so the first occurrence has genuinely happened and
      // the later ones are still ahead. A future event must never look like it already ran.
      startAt: weekdayAnchor(0, 0, 9, 0).toISOString(),
      endAt: weekdayAnchor(0, 0, 12, 0).toISOString(),
      transportMode: 'walking',
      requiresRsvp: true,
      recurrence: {
        frequency: 'weekly',
        intervalWeeks: 4,
        daysOfWeek: [0],
        endType: 'count',
        count: 3,
      },
      meetingPoints: [
        {
          label: 'Meet at the old clock tower',
          googleMapsUrl: mapsUrl(40.758, -73.9855),
          offsetMinutes: 0,
        },
      ],
    };
    const occurrences = await activitiesService.createActivity(photoGroupA.id, photoLeader.id, dto);

    // Publish the first two occurrences individually; leave the third as a draft.
    const past = occurrences[0]!;
    await activitiesService.publishActivity(past.id, photoLeader.id);
    await activitiesService.publishActivity(occurrences[1]!.id, photoLeader.id);

    // People replied before the walk, so this bypasses the start-time lock that (correctly)
    // stops a member RSVPing to an event that has already begun.
    const roster5 = roster.slice(0, 5);
    for (const member of roster5) await recordRsvp(past.id, member.id, 'approved');

    // Cross-group visitor: someone outside her regular roster, invited to just this occurrence.
    const visitor = members[10]!;
    await ensureGuest(past.id, visitor.id, photoLeader.id);
    await recordRsvp(past.id, visitor.id, 'approved');

    // The walk ran: she started it, moved the group to a second point, then ended it. Only this
    // past occurrence has more than its initial meeting point.
    await activitiesService.startActivity(past.id, photoLeader.id);
    const firstStart = new Date(past.startAt);
    // advance, not create: this is the group moving on, so the riverside is marked as reached and
    // becomes their position. Creating it would only have added it to the plan.
    await meetingPointsService.advanceToNextMeetingPoint(past.id, photoLeader.id, {
      label: 'Move to the riverside viewpoint',
      googleMapsUrl: mapsUrl(40.7605, -73.978),
      time: new Date(firstStart.getTime() + 90 * 60_000).toISOString(),
    });

    // Roll call at each stop. Two people peeled off before the riverside, which is exactly the
    // narrowing the roll-call carry-forward exists to capture.
    const [clockTower, riverside] = await listMeetingPoints(past.id);
    const walkers = [...roster5, visitor];
    if (clockTower) {
      await attendanceService.updateAttendance(clockTower.id, photoLeader.id, {
        entries: walkers.map((m) => ({ userId: m.id, status: 'present' as const })),
      });
    }
    if (riverside) {
      await attendanceService.updateAttendance(riverside.id, photoLeader.id, {
        entries: walkers.map((m, i) => ({
          userId: m.id,
          status: i < 4 ? ('present' as const) : ('absent' as const),
        })),
      });
    }
    await activitiesService.endActivity(past.id, photoLeader.id);

    // Leader posts a one-way heads-up; members can't reply here.
    await groupsService.updateGroup(photoGroupA.id, photoLeader.id, { chatMode: 'announcements' });
    await prisma.message.create({
      data: {
        groupId: photoGroupA.id,
        authorId: photoLeader.id,
        body: "This Sunday: meet at the clock tower at 9, we'll move to the riverside around 10:30 for golden hour shots.",
      },
    });
  }

  const photoGroupB = await ensureGroup(
    photoLeader.id,
    'Golden Hour Portraits',
    'Small-group portrait sessions at sunset.',
  );
  if (photoGroupB.created) {
    const roster = members.slice(0, 8);
    for (const member of roster) await ensureMembership(photoGroupB.id, member.id);

    const dto: CreateActivityDto = {
      title: 'Golden Hour Portrait Session',
      description: 'Small group, bring a friend to model or be modeled.',
      // Later today, published but not started — something to actually run when testing.
      startAt: hoursFromNow(2).toISOString(),
      endAt: hoursFromNow(4).toISOString(),
      transportMode: 'walking',
      requiresRsvp: true,
      // A route planned end to end before setting off — the group walks between three spots
      // chasing the light. Nothing is marked as reached, so "Next meeting point" on the phone
      // has a plan to work down.
      meetingPoints: [
        { label: 'Meet at the pier entrance', googleMapsUrl: mapsUrl(40.705, -74.014), offsetMinutes: 0 },
        { label: 'Under the bridge arches', googleMapsUrl: mapsUrl(40.7061, -73.9969), offsetMinutes: 45 },
        { label: 'Rooftop for the last light', googleMapsUrl: mapsUrl(40.7128, -74.0059), offsetMinutes: 90 },
      ],
    };
    const [activity] = await activitiesService.createActivity(photoGroupB.id, photoLeader.id, dto);
    await activitiesService.publishActivity(activity!.id, photoLeader.id);
  }

  // ===================== Yoga instructor =====================
  // Twice-weekly classes with a shared studio location and no RSVP requirement, plus attendance history.
  const yogaLeader = await ensureUser('yogainstructor@example.com', 'Maya Levi', 'leader');

  const yogaGroupA = await ensureGroup(
    yogaLeader.id,
    'Morning Vinyasa Flow',
    'Twice-weekly vinyasa flow — all levels welcome.',
  );
  if (yogaGroupA.created) {
    const roster = members.slice(0, 8);
    for (const member of roster) await ensureMembership(yogaGroupA.id, member.id);

    const dto: CreateActivityDto = {
      title: 'Vinyasa Flow Class',
      description: 'Mats provided. Arrive 5 minutes early to set up.',
      startAt: weekdayAnchor(1, 2, 7, 0).toISOString(), // a Monday, ~2 weeks ago
      endAt: weekdayAnchor(1, 2, 8, 0).toISOString(),
      transportMode: 'driving',
      requiresRsvp: false,
      recurrence: {
        frequency: 'weekly',
        intervalWeeks: 1,
        daysOfWeek: [1, 4], // Monday, Thursday
        endType: 'count',
        count: 8,
      },
      meetingPoints: [
        { label: 'Studio A', googleMapsUrl: mapsUrl(40.73, -73.995), offsetMinutes: 0 },
      ],
    };
    const occurrences = await activitiesService.createActivity(yogaGroupA.id, yogaLeader.id, dto);
    const seriesId = occurrences[0]!.seriesId!;
    await activitiesService.publishSeries(seriesId, yogaLeader.id);

    // Roll call already taken at the first (past) occurrence's studio, for billing purposes.
    const firstOccurrence = occurrences[0]!;
    const [studioPoint] = await listMeetingPoints(firstOccurrence.id);
    if (studioPoint) {
      await attendanceService.updateAttendance(studioPoint.id, yogaLeader.id, {
        entries: roster.map((member, i) => ({
          userId: member.id,
          status: i < 6 ? 'present' : 'absent',
        })),
      });
    }

    await prisma.message.create({
      data: { groupId: yogaGroupA.id, authorId: yogaLeader.id, body: 'Welcome to the term! See everyone Monday.' },
    });
    await prisma.message.create({
      data: { groupId: yogaGroupA.id, authorId: roster[0]!.id, body: 'Excited to start!' },
    });
  }

  const yogaGroupB = await ensureGroup(
    yogaLeader.id,
    'Evening Restorative Yoga',
    'Twice-weekly restorative yoga to unwind.',
  );
  if (yogaGroupB.created) {
    const roster = members.slice(4, 12);
    for (const member of roster) await ensureMembership(yogaGroupB.id, member.id);

    const dto: CreateActivityDto = {
      title: 'Restorative Yoga Class',
      description: 'Gentle, slow-paced session with props.',
      startAt: weekdayAnchor(2, -1, 19, 0).toISOString(), // next Tuesday, 7 PM
      endAt: weekdayAnchor(2, -1, 20, 15).toISOString(),
      transportMode: 'driving',
      requiresRsvp: false,
      recurrence: {
        frequency: 'weekly',
        intervalWeeks: 1,
        daysOfWeek: [2, 5], // Tuesday, Friday
        endType: 'count',
        count: 6,
      },
      meetingPoints: [
        { label: 'Studio B', googleMapsUrl: mapsUrl(40.735, -73.99), offsetMinutes: 0 },
      ],
    };
    const occurrences = await activitiesService.createActivity(yogaGroupB.id, yogaLeader.id, dto);
    const seriesId = occurrences[0]!.seriesId!;
    await activitiesService.publishSeries(seriesId, yogaLeader.id);

    // A member from her other group joins one session as a visitor.
    const visitor = members[0]!;
    await ensureGuest(occurrences[0]!.id, visitor.id, yogaLeader.id);
  }

  // ===================== Tour guide =====================
  // A trip is a group. Unlike a yoga class or a photo-walk club, a trek isn't a standing
  // community — it's a specific cohort who booked a specific departure and will never assemble
  // again, so the roster is the manifest and closing the group is the end of the trip.
  //
  // Within it, a day is an event: pre-trip gathering, one event per day of the trek, and a
  // reunion afterwards. Days rather than one week-long activity because the roll call has to
  // start fresh each morning — carried forward across a week, one skipped afternoon would erase
  // someone from every later day.
  const tourLeader = await ensureUser('tourguide@example.com', 'Noam Shalev', 'leader');

  /** One day of a trip: date-only, with the clock times living in its meeting points. */
  async function createTripDay(
    groupId: string,
    dayOffset: number,
    title: string,
    stops: { label: string; lat: number; lng: number; hour: number; minute?: number }[],
  ) {
    const dto: CreateActivityDto = {
      title,
      startAt: startOfDay(daysFromNow(dayOffset, 0, 0)).toISOString(),
      endAt: endOfDay(daysFromNow(dayOffset, 0, 0)).toISOString(),
      allDay: true,
      transportMode: 'driving',
      // You're on the trip because you booked it, so nobody re-confirms each morning. A member
      // sitting out one day declines that day, which is the same mechanism in reverse.
      requiresRsvp: false,
      meetingPoints: stops.map((s) => ({
        label: s.label,
        googleMapsUrl: mapsUrl(s.lat, s.lng),
        offsetMinutes: s.hour * 60 + (s.minute ?? 0),
      })),
    };
    const [day] = await activitiesService.createActivity(groupId, tourLeader.id, dto);
    await activitiesService.publishActivity(day!.id, tourLeader.id);
    return day!;
  }

  // Named after the departure so two runs of the same trip stay distinguishable. Derived from
  // the seeded date rather than written out, which would drift as the relative dates move.
  const departureLabel = (dayOffset: number) =>
    daysFromNow(dayOffset, 0, 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  // ---- Trip 1: departing in a month, fully planned ----
  const PERU_DAY_ONE = 30;
  const peru = await ensureGroup(
    tourLeader.id,
    `Peru Andes Trek — ${departureLabel(PERU_DAY_ONE)} departure`,
    'Six days trekking the Andes, two nights under canvas. Small group, all meals included.',
  );
  if (peru.created) {
    const roster = members.slice(5, 13);
    for (const member of roster) await ensureMembership(peru.id, member.id);

    // Before the trip: a standalone evening, and the one thing people do RSVP to.
    const meetGreetDto: CreateActivityDto = {
      title: 'Pre-Trip Meet & Greet',
      description: "Come meet the group before we head out — we'll cover logistics and gear.",
      startAt: daysFromNow(23, 18, 0).toISOString(),
      endAt: daysFromNow(23, 20, 0).toISOString(),
      transportMode: 'walking',
      requiresRsvp: true,
      meetingPoints: [
        { label: 'Café Meetup', googleMapsUrl: mapsUrl(41.0, 29.0), offsetMinutes: 0 },
      ],
    };
    const [meetGreet] = await activitiesService.createActivity(peru.id, tourLeader.id, meetGreetDto);
    await activitiesService.publishActivity(meetGreet!.id, tourLeader.id);
    for (const member of roster.slice(0, 6)) {
      await rsvpsService.upsertRsvp(meetGreet!.id, member.id, { status: 'approved' });
    }

    // The trek itself, a day at a time. Each day's stops are the schedule the guide walks the
    // group through; starting day 2 hands over from day 1 with no gap in between.
    await createTripDay(peru.id, PERU_DAY_ONE, 'Day 1 — Arrive in Cusco', [
      { label: 'Hotel lobby pickup', lat: -13.5319, lng: -71.9675, hour: 9 },
      { label: 'Welcome dinner', lat: -13.5164, lng: -71.9785, hour: 19, minute: 30 },
    ]);
    await createTripDay(peru.id, 31, 'Day 2 — Sacred Valley', [
      { label: 'Breakfast, then bus', lat: -13.5319, lng: -71.9675, hour: 7 },
      { label: 'Pisac market', lat: -13.4225, lng: -71.8492, hour: 10, minute: 30 },
      { label: 'Ollantaytambo guesthouse', lat: -13.2586, lng: -72.2652, hour: 17 },
    ]);
    await createTripDay(peru.id, 32, 'Day 3 — Trailhead and first camp', [
      { label: 'Trailhead briefing', lat: -13.2, lng: -72.4, hour: 6, minute: 30 },
      { label: 'Camp one', lat: -13.18, lng: -72.5, hour: 16 },
    ]);
    await createTripDay(peru.id, 33, 'Day 4 — The pass', [
      { label: 'Break camp', lat: -13.18, lng: -72.5, hour: 6 },
      { label: 'Camp two', lat: -13.15, lng: -72.6, hour: 15, minute: 30 },
    ]);
    await createTripDay(peru.id, 34, 'Day 5 — Machu Picchu', [
      { label: 'Gate queue', lat: -13.1631, lng: -72.545, hour: 5, minute: 30 },
      { label: 'Bus back to Aguas Calientes', lat: -13.1547, lng: -72.5253, hour: 14 },
    ]);
    await createTripDay(peru.id, 35, 'Day 6 — Home', [
      { label: 'Airport drop-off', lat: -13.5357, lng: -71.9388, hour: 10 },
    ]);

    // Afterwards: photos and a drink, three weeks later.
    const reunionDto: CreateActivityDto = {
      title: 'Post-Trip Reunion',
      description: 'Bring your photos. First round on me.',
      startAt: daysFromNow(56, 19, 0).toISOString(),
      endAt: daysFromNow(56, 22, 0).toISOString(),
      transportMode: 'transit',
      requiresRsvp: true,
      meetingPoints: [
        { label: 'The Old Bell', googleMapsUrl: mapsUrl(41.0082, 28.9784), offsetMinutes: 0 },
      ],
    };
    const [reunion] = await activitiesService.createActivity(peru.id, tourLeader.id, reunionDto);
    await activitiesService.publishActivity(reunion!.id, tourLeader.id);
  }

  // ---- Trip 2: a different cohort, still being planned ----
  const ICELAND_DAY_ONE = 90;
  const iceland = await ensureGroup(
    tourLeader.id,
    `Iceland Ring Road — ${departureLabel(ICELAND_DAY_ONE)} departure`,
    'A guided loop of the ring road. Bookings still open.',
  );
  if (iceland.created) {
    // A different set of people, as a later departure would be.
    for (const member of members.slice(11, 15)) await ensureMembership(iceland.id, member.id);

    await createTripDay(iceland.id, ICELAND_DAY_ONE, 'Day 1 — Arrivals and Reykjavík', [
      { label: 'Airport arrivals hall', lat: 63.985, lng: -22.6056, hour: 8 },
      { label: 'Guesthouse check-in', lat: 64.1466, lng: -21.9426, hour: 14 },
    ]);
    await createTripDay(iceland.id, ICELAND_DAY_ONE + 1, 'Day 2 — Golden Circle', [
      { label: 'Minibus departs', lat: 64.1466, lng: -21.9426, hour: 8, minute: 30 },
      { label: 'Geysir', lat: 64.3104, lng: -20.3024, hour: 11 },
    ]);
  }

  console.log('[seed] persona data ready: photoinstructor, yogainstructor, tourguide (password: ' + TEST_PASSWORD + ')');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Redis connections opened by createRealtimeServer would otherwise keep the process alive.
    process.exit(process.exitCode ?? 0);
  });
