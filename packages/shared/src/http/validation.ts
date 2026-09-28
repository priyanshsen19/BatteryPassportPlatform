import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { Errors } from '../errors';
import { objectIdSchema, type ErrorDetail } from '../schemas/common';

export function formatZodIssues(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/** Validates req.body before it reaches the controller and replaces it with the parsed value. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(Errors.validation(formatZodIssues(result.error)));
    req.body = result.data;
    return next();
  };
}

/** Parses query parameters (read-only in Express 5, so the parsed value is returned). */
export function parseQuery<S extends z.ZodType>(schema: S, query: unknown): z.infer<S> {
  const result = schema.safeParse(query);
  if (!result.success) throw Errors.validation(formatZodIssues(result.error), 'Invalid query parameters');
  return result.data;
}

export function validateObjectIdParam(param: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[param];
    if (!objectIdSchema.safeParse(value).success) {
      return next(Errors.badRequest(`'${value}' is not a valid ${param}`, 'INVALID_ID'));
    }
    return next();
  };
}
