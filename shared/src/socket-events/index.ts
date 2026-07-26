import type { Activity, LocationSnapshot, MeetingPoint, MessageWithAuthor, Rsvp } from '../types/index.js';

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
  message: MessageWithAuthor;
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
