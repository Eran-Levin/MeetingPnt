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
  name: string;
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
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface GroupWithRole extends Group {
  isLeader: boolean;
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
  group: Pick<Group, 'id' | 'name'>;
}

export interface Activity {
  id: string;
  groupId: string;
  seriesId: string | null;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  transportMode: TransportMode;
  requiresRsvp: boolean;
  status: ActivityStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  activityId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
}

export interface AttendanceWithUser extends Attendance {
  user: Pick<User, 'id' | 'name' | 'email'>;
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
