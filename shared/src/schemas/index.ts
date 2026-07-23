import { z } from 'zod';
import { RsvpStatus, TransportMode } from '../enums/index.js';

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ---- auth ----
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  invitationToken: z.string().optional(),
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

export const updateGroupSchema = createGroupSchema.partial();

// ---- invitations ----
export const inviteMemberSchema = z.object({
  email: z.string().email(),
});

// ---- activities ----
export const recurrenceRuleSchema = z
  .object({
    frequency: z.literal('weekly'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    endType: z.enum(['count', 'until']),
    count: z.number().int().min(1).max(52).optional(),
    until: z.string().datetime().optional(),
  })
  .refine((rule) => (rule.endType === 'count' ? rule.count != null : rule.until != null), {
    message: 'count is required when endType is "count", until is required when endType is "until"',
  });

export const createActivitySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startAt: z.string().datetime(),
  transportMode: z.enum([
    TransportMode.Driving,
    TransportMode.Walking,
    TransportMode.Bicycling,
    TransportMode.Transit,
  ]),
  recurrence: recurrenceRuleSchema.optional(),
});

export const updateActivitySchema = createActivitySchema.omit({ recurrence: true }).partial();

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

// ---- meeting points ----
export const createMeetingPointSchema = z.object({
  label: z.string().optional(),
  googleMapsUrl: z.string().url(),
  time: z.string().datetime(),
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
