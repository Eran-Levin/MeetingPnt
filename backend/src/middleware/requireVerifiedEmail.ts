import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { needsVerification } from '../modules/auth/emailVerification.js';
import { errorBody } from './errorHandler.js';

/**
 * Refuses a leader who hasn't confirmed their email address yet. Goes on the routes that start a
 * leader off — creating a group — since everything else a leader does happens inside one. Read
 * from the database, not the token: confirming takes effect at once, without signing in again.
 */
export async function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true, emailVerifiedAt: true },
    });
    if (user && needsVerification(user)) {
      return res.status(403).json(errorBody('email_not_verified'));
    }
    next();
  } catch (err) {
    next(err);
  }
}
