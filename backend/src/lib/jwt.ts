import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '@meetingpnt/shared';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
}
