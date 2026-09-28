import type { ErrorDetail } from './schemas/common';

/**
 * Expected, client-facing failure. Anything else reaching the error handler is treated as
 * an unexpected 500 and its message is hidden in production.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message),
  unauthorized: (message = 'Authentication required', code = 'UNAUTHORIZED') =>
    new AppError(401, code, message),
  forbidden: (message = 'You do not have permission to perform this action', code = 'FORBIDDEN') =>
    new AppError(403, code, message),
  notFound: (code: string, message: string) => new AppError(404, code, message),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  payloadTooLarge: (message: string) => new AppError(413, 'PAYLOAD_TOO_LARGE', message),
  unsupportedMediaType: (message: string) => new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message),
  validation: (details: ErrorDetail[], message = 'Request validation failed') =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  badGateway: (code: string, message: string) => new AppError(502, code, message),
  serviceUnavailable: (code: string, message: string) => new AppError(503, code, message),
};
