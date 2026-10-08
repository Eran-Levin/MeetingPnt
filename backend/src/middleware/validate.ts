import { isErrorCode, type ErrorCode, type ErrorParams } from '@meetingpnt/shared';
import type { NextFunction, Request, Response } from 'express';
import type { ZodIssue, ZodSchema } from 'zod';
import { errorBody } from './errorHandler.js';

/**
 * Schemas in `shared` write their own messages as error codes ('end_before_start'), so those pass
 * straight through. Zod's built-in complaints ("Invalid email") are mapped to the nearest code
 * here; anything else is the generic "some of what you entered isn't valid".
 */
function toError(issue: ZodIssue | undefined): { code: ErrorCode; params?: ErrorParams } {
  if (!issue) return { code: 'validation_failed' };
  if (isErrorCode(issue.message)) return { code: issue.message };
  if (issue.code === 'invalid_string' && issue.validation === 'email') return { code: 'invalid_email' };
  if (issue.code === 'invalid_string' && issue.validation === 'url') return { code: 'invalid_url' };
  if (issue.code === 'too_small' && issue.type === 'string') {
    return { code: 'too_short', params: { minimum: Number(issue.minimum) } };
  }
  return { code: 'validation_failed' };
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const { code, params } = toError(result.error.issues[0]);
      return res.status(400).json({ ...errorBody(code, params), issues: result.error.issues });
    }
    req.body = result.data;
    next();
  };
}
