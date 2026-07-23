import type { z } from 'zod';
import type {
  createActivitySchema,
  createGroupSchema,
  createMeetingPointSchema,
  inviteMemberSchema,
  loginSchema,
  omwLocationSchema,
  pingRequestSchema,
  pingResponseSchema,
  pushTokenSchema,
  registerSchema,
  roleElevationSchema,
  rsvpUpdateSchema,
  updateActivitySchema,
  updateGroupSchema,
} from '../schemas/index.js';
import type { User } from '../types/index.js';

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RoleElevationDto = z.infer<typeof roleElevationSchema>;
export type CreateGroupDto = z.infer<typeof createGroupSchema>;
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type CreateActivityDto = z.infer<typeof createActivitySchema>;
export type UpdateActivityDto = z.infer<typeof updateActivitySchema>;
export type RsvpUpdateDto = z.infer<typeof rsvpUpdateSchema>;
export type CreateMeetingPointDto = z.infer<typeof createMeetingPointSchema>;
export type OmwLocationDto = z.infer<typeof omwLocationSchema>;
export type PingRequestDto = z.infer<typeof pingRequestSchema>;
export type PingResponseDto = z.infer<typeof pingResponseSchema>;
export type PushTokenDto = z.infer<typeof pushTokenSchema>;

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
