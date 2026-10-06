import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@meetingpnt/shared';
import { errorBody } from './errorHandler.js';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(errorBody('not_authenticated'));
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(errorBody('forbidden'));
    }
    next();
  };
}
