import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Schemas carry written-out messages ("The end must be after the start"); surfacing the
      // first one means the client can show it as-is instead of a bare "Validation failed".
      const [first] = result.error.issues;
      return res
        .status(400)
        .json({ error: first?.message ?? 'Validation failed', issues: result.error.issues });
    }
    req.body = result.data;
    next();
  };
}
