import { z } from 'zod';
import { AttendanceStatus, GroupChatMode, GroupStatus, LOCALES, NAV_APPS, RsvpStatus, TransportMode, type Locale, type NavApp } from '../enums/index.js';

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ---- auth ----
/** Loose on purpose — international formats vary far too much to validate meaningfully. */
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(30)
  .regex(/^[+0-9][0-9\s\-()]*$/, 'invalid_phone');

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string({ required_error: 'first_name_required' }).trim().min(1, 'first_name_required'),
  lastName: z.string({ required_error: 'last_name_required' }).trim().min(1, 'last_name_required'),
  phone: phoneSchema.optional(),
  invitationToken: z.string().optional(),
  // The portal's "start leading" sign-up. Ignored when an invitation token is present: an invited
  // person is a member of someone's group, not a new leader.
  asLeader: z.boolean().optional(),
  locale: z.enum(LOCALES as [Locale, ...Locale[]]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---- admin ----
export const roleElevationSchema = z.object({
  role: z.enum(['admin', 'leader', 'user']),
});

// ---- groups ----
export const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/**
 * A new group started from an existing one. What comes across is the leader's call: the roster
 * (the same people carrying on) and the events (the same trip run again, as drafts). Events move
 * by `shiftDays` whole days, in the leader's `timeZone` so a 08:00 start stays 08:00.
 */
export const duplicateGroupSchema = createGroupSchema.extend({
  copyRoster: z.boolean(),
  copyEvents: z.boolean(),
  shiftDays: z.number().int().min(-3650).max(3650).default(0),
  timeZone: z.string().min(1).default('UTC'),
});

export const updateGroupSchema = createGroupSchema
  .extend({
    status: z.enum([GroupStatus.Planned, GroupStatus.InProgress, GroupStatus.Completed]),
    chatMode: z.enum([GroupChatMode.Announcements, GroupChatMode.TwoWay]),
  })
  .partial();

// ---- invitations ----
/**
 * The leader knows who they're inviting, so they supply the name and phone rather than waiting
 * for the invitee to fill them in — the roster is useful the moment the invitation goes out.
 */
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  firstName: z.string({ required_error: 'first_name_required' }).trim().min(1, 'first_name_required'),
  lastName: z.string({ required_error: 'last_name_required' }).trim().min(1, 'last_name_required'),
  phone: phoneSchema.optional(),
  // A party is declared here but formed later: the leader only sets its size and name when
  // inviting the rep. The rep names the rest of the party themselves once they've registered.
  partyName: z.string().trim().min(1).optional(),
  partySize: z.number().int().min(1).max(20).optional(),
});

/** One named party member — the rep supplies these for everyone beyond themselves. */
export const partyMemberSchema = z.object({
  firstName: z.string({ required_error: 'first_name_required' }).trim().min(1, 'first_name_required'),
  lastName: z.string({ required_error: 'last_name_required' }).trim().min(1, 'last_name_required'),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
});

export const addPartyMembersSchema = z.object({
  members: z.array(partyMemberSchema).min(1),
});

// ---- activities ----
export const recurrenceRuleSchema = z
  .object({
    frequency: z.literal('weekly'),
    // Number of weeks between occurrences, e.g. 1 = every week, 4 = every four weeks.
    intervalWeeks: z.number().int().min(1).max(12).default(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    endType: z.enum(['count', 'until']),
    count: z.number().int().min(1).max(52).optional(),
    until: z.string().datetime().optional(),
  })
  .refine((rule) => (rule.endType === 'count' ? rule.count != null : rule.until != null), {
    message: 'recurrence_end_required',
  });

// A meeting point to clone onto every generated occurrence of a recurring activity.
export const meetingPointTemplateSchema = z.object({
  label: z.string().optional(),
  googleMapsUrl: z.string().url(),
  // Minutes relative to each occurrence's startAt (e.g. 0 = at start time, -15 = 15 min before).
  offsetMinutes: z.number().int().min(-1440).max(1440),
});

const createActivityBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  // Multi-day activities are date-only: the daily schedule lives in the meeting points.
  allDay: z.boolean().default(false),
  transportMode: z.enum([
    TransportMode.Driving,
    TransportMode.Walking,
    TransportMode.Bicycling,
    TransportMode.Transit,
  ]),
  requiresRsvp: z.boolean().default(true),
  // A yoga class happens in one room: there is no route to plan, so the clients drop the
  // itinerary entirely rather than showing a one-item list and an "add stop" button.
  singleLocation: z.boolean().default(false),
  recurrence: recurrenceRuleSchema.optional(),
  meetingPoints: z.array(meetingPointTemplateSchema).max(5).optional(),
});

export const createActivitySchema = createActivityBaseSchema.refine(
  (data) => new Date(data.endAt) > new Date(data.startAt),
  { message: 'end_before_start', path: ['endAt'] },
);

// A multi-day event is created with its days: the client works out each day's dates (and its title,
// in the leader's language and time zone) and the server stores them as draft day events.
export const createMultiDayEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  days: z
    .array(
      z
        .object({
          title: z.string().min(1),
          startAt: z.string().datetime(),
          endAt: z.string().datetime(),
        })
        .refine((day) => new Date(day.endAt) > new Date(day.startAt), { message: 'end_before_start' }),
    )
    .min(1)
    .max(60),
  transportMode: z
    .enum([
      TransportMode.Driving,
      TransportMode.Walking,
      TransportMode.Bicycling,
      TransportMode.Transit,
    ])
    .default(TransportMode.Walking),
  // Trip days are not re-confirmed each morning: everyone starts approved and declines the day they skip.
  requiresRsvp: z.boolean().default(false),
});

// Renaming also renames the days that carry the old title as a prefix ("Peru Trek · Day 2").
// An empty description clears it.
export const updateMultiDayEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

// Whole calendar days, in the leader's own time zone (sent by the browser — the server runs UTC),
// so an 08:00 start stays 08:00 across a daylight-saving change.
export const moveMultiDayEventSchema = z.object({
  shiftDays: z.number().int().min(-3650).max(3650),
  timeZone: z.string().min(1).default('UTC'),
});

// A copy carries the shape — title, description, days and their stops — as drafts, moved by
// `shiftDays`. RSVPs, attendance and progress stay behind. `title` renames the copy (and its days).
export const copyMultiDayEventSchema = moveMultiDayEventSchema.extend({
  title: z.string().min(1).optional(),
});

export const updateActivitySchema =createActivityBaseSchema
  .omit({ recurrence: true, meetingPoints: true })
  .partial()
  // Only enforceable when a patch carries both ends; a one-sided edit is checked in the service.
  .refine(
    (data) => !data.startAt || !data.endAt || new Date(data.endAt) > new Date(data.startAt),
    { message: 'end_before_start', path: ['endAt'] },
  );

// ---- rsvps ----
export const rsvpUpdateSchema = z.object({
  status: z.enum([RsvpStatus.Approved, RsvpStatus.Declined]),
  note: z.string().max(500).optional(),
});

// ---- users ----
export const pushTokenSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

export const updateLocaleSchema = z.object({
  locale: z.enum(LOCALES as [Locale, ...Locale[]]),
});

export const updateNavAppSchema = z.object({
  navApp: z.enum(NAV_APPS as [NavApp, ...NavApp[]]),
});

// ---- meeting points ----
export const createMeetingPointSchema = z.object({
  label: z.string().optional(),
  googleMapsUrl: z.string().url(),
  // Optional: a point dropped mid-event is happening now, so the server defaults it.
  time: z.string().datetime().optional(),
  // Manual fallback pin, used only if the URL can't be parsed server-side.
  location: geoPointSchema.optional(),
});

export const updateMeetingPointSchema = createMeetingPointSchema.partial();

// ---- locations ----
export const omwLocationSchema = z.object({
  location: geoPointSchema,
});

export const pingRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const pingResponseSchema = z.object({
  location: geoPointSchema,
});

// ---- attendance ----
export const attendanceEntrySchema = z.object({
  userId: z.string().uuid(),
  status: z.enum([AttendanceStatus.Present, AttendanceStatus.Absent]),
});

export const updateAttendanceSchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1),
});

// ---- chat ----
// Multipart request: `body` lands here via multer's text-field parsing; the image (if any)
// arrives as req.file and is validated separately in the route, not through this schema.
export const sendMessageSchema = z.object({
  body: z.string().max(2000).optional(),
});
