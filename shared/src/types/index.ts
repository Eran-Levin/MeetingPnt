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
  /** Absolute URL of the photo they took of themselves, or null. Everywhere a person is listed
   * shows a face when there is one and their initials when there isn't. */
  avatarUrl: string | null;
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
  user: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'avatarUrl'>;
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
  /** Deep link into the app for this invitation, for someone who already has it installed. */
  appLink: string;
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
  /**
   * One place, no route — a yoga class in the same room every week. The clients show a single
   * meeting point instead of an itinerary and offer no way to add a second stop. Stored rather
   * than derived from the number of stops, because a walk being planned also has one stop and
   * must keep its "add stop" button.
   */
  singleLocation: boolean;
  status: ActivityStatus;
  /**
   * Where the group is right now. Null before the event starts, and while it runs it lags the
   * end of the itinerary — the leader may have planned five stops but only walked to two.
   */
  currentMeetingPointId: string | null;
  /**
   * "Follow me": until when the leader is sharing a live position. Null means they aren't, and a
   * time already past means the lease lapsed — so clients must compare against now rather than
   * treat non-null as on. Use `isLeaderBroadcasting`.
   */
  leaderBroadcastUntil: string | null;
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
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
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
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
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
  author: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

/**
 * One message in a conversation between two people. Group chat is about the event; this is the
 * side channel it can't carry — "can I get a lift", "I'm two minutes behind you" — so it hangs
 * off the pair of people, not off a group or an activity.
 */
export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
}

/** A direct thread as one side sees it: the messages, and who they are talking to. */
export interface DirectThread {
  withUser: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  messages: DirectMessage[];
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
  /** When the group actually reached this stop. Null means it's still a planned stop. */
  arrivedAt: string | null;
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

/** The answer to a member asking the leader where they are. */
export interface LeaderLocationRequestResult {
  /** The leader's last known position — null if they've never reported one, and possibly stale. */
  location: LocationSnapshotWithUser | null;
  /** False when nobody was disturbed: the position was already fresh, or another member had
   * just asked and the leader has been notified once for all of them. */
  notified: boolean;
}
