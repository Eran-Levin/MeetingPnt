import { createServer } from 'node:http';
import type { CreateActivityDto } from '@meetingpnt/shared';
import { env } from '../src/config/env.js';
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

async function ensureUser(email: string, name: string, role: 'admin' | 'leader' | 'user') {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  return prisma.user.create({ data: { email, name, role, passwordHash } });
}

async function ensureMembership(groupId: string, userId: string) {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, status: 'active' },
    update: { status: 'active' },
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
      startAt: weekdayAnchor(0, -1, 9, 0).toISOString(), // next Sunday, 9:00 AM
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
    await activitiesService.publishActivity(occurrences[0]!.id, photoLeader.id);
    await activitiesService.publishActivity(occurrences[1]!.id, photoLeader.id);

    // Mid-session move: a second meeting point on the first occurrence, 90 minutes later.
    const firstStart = new Date(occurrences[0]!.startAt);
    await meetingPointsService.createMeetingPoint(occurrences[0]!.id, photoLeader.id, {
      label: 'Move to the riverside viewpoint',
      googleMapsUrl: mapsUrl(40.7605, -73.978),
      time: new Date(firstStart.getTime() + 90 * 60_000).toISOString(),
    });

    // Half the roster confirms attendance on the first occurrence.
    for (const member of roster.slice(0, 5)) {
      await rsvpsService.upsertRsvp(occurrences[0]!.id, member.id, { status: 'approved' });
    }

    // Cross-group visitor: someone outside her regular roster, invited to just this occurrence.
    const visitor = members[10]!;
    await ensureGuest(occurrences[0]!.id, visitor.id, photoLeader.id);
    await rsvpsService.upsertRsvp(occurrences[0]!.id, visitor.id, { status: 'approved' });

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
      startAt: daysFromNow(10, 18, 30).toISOString(),
      transportMode: 'walking',
      requiresRsvp: true,
      meetingPoints: [
        { label: 'Meet at the pier entrance', googleMapsUrl: mapsUrl(40.705, -74.014), offsetMinutes: 0 },
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

    // Roll call already taken for the first (past) occurrence, for billing purposes.
    const firstOccurrence = occurrences[0]!;
    await attendanceService.updateAttendance(firstOccurrence.id, yogaLeader.id, {
      entries: roster.map((member, i) => ({
        userId: member.id,
        status: i < 6 ? 'present' : 'absent',
      })),
    });

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
  // Multi-day tours with day-by-day meeting points, plus a pre-tour meet-and-greet.
  const tourLeader = await ensureUser('tourguide@example.com', 'Noam Shalev', 'leader');

  const tourGroup = await ensureGroup(
    tourLeader.id,
    'Adventure Tours 2026',
    'Small-group multi-day guided tours.',
  );
  if (tourGroup.created) {
    const roster = members.slice(5, 15);
    for (const member of roster) await ensureMembership(tourGroup.id, member.id);

    // Pre-tour meet-and-greet — a standalone activity, one week before the first tour.
    const meetGreetDto: CreateActivityDto = {
      title: 'Pre-Trip Meet & Greet',
      description: "Come meet the group before we head out — we'll cover logistics and gear.",
      startAt: daysFromNow(23, 18, 0).toISOString(),
      transportMode: 'walking',
      requiresRsvp: true,
      meetingPoints: [
        { label: 'Café Meetup', googleMapsUrl: mapsUrl(41.0, 29.0), offsetMinutes: 0 },
      ],
    };
    const [meetGreet] = await activitiesService.createActivity(tourGroup.id, tourLeader.id, meetGreetDto);
    await activitiesService.publishActivity(meetGreet!.id, tourLeader.id);
    for (const member of roster.slice(0, 6)) {
      await rsvpsService.upsertRsvp(meetGreet!.id, member.id, { status: 'approved' });
    }

    // Tour 1: a 7-day trek.
    const tour1Start = daysFromNow(30, 7, 0);
    const tour1Dto: CreateActivityDto = {
      title: 'Peru Andes Trek',
      description: '7-day guided trek through the Andes, including two nights of camping.',
      startAt: tour1Start.toISOString(),
      endAt: daysFromNow(37, 20, 0).toISOString(),
      transportMode: 'driving',
      requiresRsvp: true,
    };
    const [tour1] = await activitiesService.createActivity(tourGroup.id, tourLeader.id, tour1Dto);
    await activitiesService.publishActivity(tour1!.id, tourLeader.id);
    for (const member of roster.slice(0, 8)) {
      await rsvpsService.upsertRsvp(tour1!.id, member.id, { status: 'approved' });
    }
    await meetingPointsService.createMeetingPoint(tour1!.id, tourLeader.id, {
      label: 'Day 1 — Hotel lobby pickup',
      googleMapsUrl: mapsUrl(-13.5319, -71.9675),
      time: tour1Start.toISOString(),
    });
    await meetingPointsService.createMeetingPoint(tour1!.id, tourLeader.id, {
      label: 'Day 3 — Trailhead departure',
      googleMapsUrl: mapsUrl(-13.2833, -72.2167),
      time: new Date(tour1Start.getTime() + 2 * 86_400_000 - 60 * 60_000).toISOString(),
    });
    await meetingPointsService.createMeetingPoint(tour1!.id, tourLeader.id, {
      label: 'Day 7 — Return transport pickup',
      googleMapsUrl: mapsUrl(-13.5319, -71.9675),
      time: new Date(tour1Start.getTime() + 6 * 86_400_000 + 10 * 60 * 60_000).toISOString(),
    });

    // Tour 2: a later, non-overlapping trip.
    const tour2Start = daysFromNow(90, 8, 0);
    const tour2Dto: CreateActivityDto = {
      title: 'Iceland Ring Road',
      description: '7-day self-drive-style guided loop around Iceland.',
      startAt: tour2Start.toISOString(),
      endAt: daysFromNow(97, 19, 0).toISOString(),
      transportMode: 'driving',
      requiresRsvp: true,
    };
    const [tour2] = await activitiesService.createActivity(tourGroup.id, tourLeader.id, tour2Dto);
    await activitiesService.publishActivity(tour2!.id, tourLeader.id);
    await meetingPointsService.createMeetingPoint(tour2!.id, tourLeader.id, {
      label: 'Day 1 — Airport arrivals',
      googleMapsUrl: mapsUrl(63.985, -22.6056),
      time: tour2Start.toISOString(),
    });
    await meetingPointsService.createMeetingPoint(tour2!.id, tourLeader.id, {
      label: 'Day 4 — Waterfall parking lot',
      googleMapsUrl: mapsUrl(63.6172, -19.9789),
      time: new Date(tour2Start.getTime() + 3 * 86_400_000 - 2 * 60 * 60_000).toISOString(),
    });
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
