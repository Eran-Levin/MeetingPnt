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
});

export const updateActivitySchema = createActivitySchema.partial();

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
  location: geoPointSchema,
  reconveneTime: z.string().datetime().optional(),
});

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
