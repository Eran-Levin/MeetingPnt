import type {
  ActivityStatus,
  AttendanceStatus,
  GroupChatMode,
  GroupMemberStatus,
  GroupStatus,
  InvitationStatus,
  LocationSource,
  Role,
  RsvpStatus,
  TransportMode,
} from '../enums/index.js';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** `firstName lastName`, derived server-side so every screen renders a person the same way. */
  name: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  status: GroupStatus;
  chatMode: GroupChatMode;
  leaderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  joinedAt: string;
}

export interface GroupMemberWithUser extends GroupMember {
  /** The roster carries the phone number — it's how a leader reaches someone who hasn't shown up. */
  user: Pick<User, 'id' | 'name' | 'email' | 'phone'>;
}

export interface GroupWithRole extends Group {
  isLeader: boolean;
  /** Start of the soonest activity that hasn't finished yet, or null if nothing is scheduled. */
  nextActivityAt: string | null;
}

export interface Invitation {
  id: string;
  groupId: string;
  activityId: string | null;
  email: string;
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface ActivityGuest {
  id: string;
  activityId: string;
  userId: string;
  invitedBy: string;
  createdAt: string;
}

export interface ActivityGuestWithUser extends ActivityGuest {
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface InvitationPreview {
  email: string;
  /** What the leader entered when inviting — the sign-up form starts from these. */
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  group: Pick<Group, 'id' | 'name'>;
}

export interface Activity {
  id: string;
  groupId: string;
  seriesId: string | null;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  /** Multi-day/date-only activity: clock times are not meaningful and are hidden in the UI. */
  allDay: boolean;
  transportMode: TransportMode;
  requiresRsvp: boolean;
  status: ActivityStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Attendance is recorded per meeting point, not per activity — a group that moves between
 * sites needs to know who was present at each one. Activity-level participation is derived
 * from these (see ActivityParticipation). */
/** An activity carrying enough group context to render in a cross-group timeline. */
export interface ActivityWithGroup extends Activity {
  group: Pick<Group, 'id' | 'name'>;
  isLeader: boolean;
  /** The caller's own RSVP, so the timeline can flag events still awaiting a reply. Null for a
   * leader, who doesn't RSVP to their own event. */
  myRsvpStatus: RsvpStatus | null;
}

/** Someone confirmed as coming, as shown to fellow members. Deliberately carries no attendance
 * data — the roll call is the leader's view, not something peers see about each other. */
export interface Attendee {
  user: Pick<User, 'id' | 'name'>;
  isVisitor: boolean;
}

export interface Attendance {
  id: string;
  meetingPointId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

export interface AttendanceWithUser extends Attendance {
  user: Pick<User, 'id' | 'name' | 'email'>;
}

/**
 * One person on the roll call for a meeting point, merging their RSVP with whether they've
 * been marked present there. The roster narrows as the group moves: the first meeting point
 * expects everyone who hasn't declined, each later one expects whoever made the previous stop.
 */
export interface RollCallEntry {
  user: Pick<User, 'id' | 'name' | 'email'>;
  isVisitor: boolean;
  rsvpStatus: RsvpStatus;
  /** null until the leader marks them at this meeting point. */
  attendance: AttendanceStatus | null;
}

/** Roll-up across every meeting point of one activity: attended if present at any of them. */
export interface ActivityParticipation {
  user: Pick<User, 'id' | 'name' | 'email'>;
  attended: boolean;
  presentCount: number;
  totalMeetingPoints: number;
}

export interface Message {
  id: string;
  groupId: string;
  authorId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface MessageWithAuthor extends Message {
  author: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Rsvp {
  id: string;
  activityId: string;
  userId: string;
  status: RsvpStatus;
  note: string | null;
  respondedAt: string | null;
  updatedAt: string;
}

export interface RsvpWithUser extends Rsvp {
  user: Pick<User, 'id' | 'name' | 'email'>;
  /** True for an activity guest ("visitor") rather than a member of the group. */
  isVisitor: boolean;
}

export interface MeetingPoint {
  id: string;
  groupId: string;
  activityId: string | null;
  label: string | null;
  googleMapsUrl: string;
  location: GeoPoint;
  time: string;
  createdBy: string;
  createdAt: string;
}

export interface LocationSnapshot {
  id: string;
  activityId: string;
  userId: string;
  meetingPointId: string | null;
  location: GeoPoint;
  capturedAt: string;
  etaSeconds: number | null;
  etaComputedAt: string | null;
  source: LocationSource;
  createdAt: string;
}

export interface LocationSnapshotWithUser extends LocationSnapshot {
  user: Pick<User, 'id' | 'name' | 'email'> | null;
}
