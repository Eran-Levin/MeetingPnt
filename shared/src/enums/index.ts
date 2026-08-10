export const Role = {
  Admin: 'admin',
  Leader: 'leader',
  User: 'user',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const GroupStatus = {
  Planned: 'planned',
  InProgress: 'in_progress',
  Completed: 'completed',
} as const;
export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus];

export const GroupChatMode = {
  Announcements: 'announcements',
  TwoWay: 'two_way',
} as const;
export type GroupChatMode = (typeof GroupChatMode)[keyof typeof GroupChatMode];

export const GroupMemberStatus = {
  Active: 'active',
  Removed: 'removed',
} as const;
export type GroupMemberStatus = (typeof GroupMemberStatus)[keyof typeof GroupMemberStatus];

export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Expired: 'expired',
  Revoked: 'revoked',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const ActivityStatus = {
  Draft: 'draft',
  Published: 'published',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const TransportMode = {
  Driving: 'driving',
  Walking: 'walking',
  Bicycling: 'bicycling',
  Transit: 'transit',
} as const;
export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

export const RsvpStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Declined: 'declined',
} as const;
export type RsvpStatus = (typeof RsvpStatus)[keyof typeof RsvpStatus];

export const LocationSource = {
  Omw: 'omw',
  PingResponse: 'ping_response',
  /** A fix from the leader's live "follow me" broadcast. Carries no ETA — the leader isn't
   * travelling to the meeting point, they're what everyone else is heading towards. */
  LeaderBroadcast: 'leader_broadcast',
} as const;
export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource];

export const AttendanceStatus = {
  Present: 'present',
  Absent: 'absent',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
