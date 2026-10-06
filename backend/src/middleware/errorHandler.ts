import type { NextFunction, Request, Response } from 'express';
import {
  englishErrorMessage,
  type ApiErrorBody,
  type ErrorCode,
  type ErrorParams,
} from '@meetingpnt/shared';

/**
 * A refusal the client can show in the reader's language. `code` is the contract — one of the keys
 * in the shared catalog's `errors` section, so a code that doesn't exist doesn't compile — and
 * `params` fills the blanks in it (a group name, a count). The English sentence rides along as
 * `message` for logs and for clients that don't translate.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public params?: ErrorParams,
  ) {
    super(englishErrorMessage(code, params));
  }
}

/** The one place an error response is shaped, so every refusal carries a code. */
export function errorBody(code: ErrorCode, params?: ErrorParams): ApiErrorBody {
  return { error: englishErrorMessage(code, params), code, ...(params ? { params } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json(errorBody(err.code, err.params));
  }
  console.error(err);
  res.status(500).json(errorBody('internal'));
}
