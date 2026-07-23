import type { Activity, LocationSnapshot, MeetingPoint, Rsvp } from '../types/index.js';

export const SocketEvents = {
  GroupJoin: 'group:join',
  ActivityJoin: 'activity:join',
  ChatMessage: 'chat:message',
  RsvpUpdated: 'rsvp:updated',
  LocationUpdated: 'location:updated',
  MeetingPointCreated: 'meetingPoint:created',
  ActivityPublished: 'activity:published',
} as const;
export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface ChatMessagePayload {
  id: string;
  groupId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface RsvpUpdatedPayload {
  rsvp: Rsvp;
}

export interface LocationUpdatedPayload {
  snapshot: LocationSnapshot;
}

export interface MeetingPointCreatedPayload {
  meetingPoint: MeetingPoint;
}

export interface ActivityPublishedPayload {
  activity: Activity;
}
