import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, Errors } from '../errors';
import type { Logger } from '../logger';
import type { ApiFailure } from '../schemas/common';
import { formatZodIssues } from './validation';

interface LibraryError {
  name?: string;
  type?: string;
  code?: number | string;
  keyValue?: Record<string, unknown>;
  path?: string;
}

/** Maps errors raised by Express, Zod and Mongoose onto client-facing AppErrors. */
function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return Errors.validation(formatZodIssues(err));

  const e = (err ?? {}) as LibraryError;
  if (e.type === 'entity.parse.failed')
    return Errors.badRequest('Request body contains malformed JSON', 'MALFORMED_JSON');
  if (e.type === 'entity.too.large') return Errors.payloadTooLarge('Request body is too large');
  if (e.name === 'CastError') return Errors.badRequest(`Invalid value for '${e.path}'`, 'INVALID_ID');
  if (e.code === 11000) {
    const fields = Object.keys(e.keyValue ?? {}).join(', ') || 'unique field';
    return Errors.conflict('DUPLICATE_RESOURCE', `A resource with the same ${fields} already exists`);
  }
  return null;
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(Errors.notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

export function createErrorHandler(
  logger: Logger,
  options: { exposeInternalErrors: boolean },
): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const appError = toAppError(err);
    const statusCode = appError?.statusCode ?? 500;
    const context = { requestId: req.requestId, method: req.method, path: req.path, statusCode };

    if (statusCode >= 500) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(error.message, { ...context, code: appError?.code, stack: error.stack });
    } else {
      logger.warn(appError?.message ?? 'Request failed', { ...context, code: appError?.code });
    }

    const internalMessage = options.exposeInternalErrors && err instanceof Error ? err.message : undefined;
    const body: ApiFailure = {
      success: false,
      error: {
        code: appError?.code ?? 'INTERNAL_ERROR',
        message: appError?.message ?? internalMessage ?? 'An unexpected error occurred',
        ...(appError?.details ? { details: appError.details } : {}),
        requestId: req.requestId,
      },
    };
    res.status(statusCode).json(body);
  };
}
