import type {
  ActivityStatus,
  GroupMemberStatus,
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
  email: string;
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  email: string;
  group: Pick<Group, 'id' | 'name'>;
}

export interface Activity {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startAt: string;
  transportMode: TransportMode;
  status: ActivityStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  location: GeoPoint;
  isPrimary: boolean;
  reconveneTime: string | null;
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
