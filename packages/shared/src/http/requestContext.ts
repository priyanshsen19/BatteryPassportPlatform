import { randomUUID } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Logger } from '../logger';
import '../auth/context';

const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;

/**
 * Re-uses an incoming x-request-id (so one id follows a request across services) or
 * generates a new one, and echoes it back on the response.
 */
export function requestId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get('x-request-id');
    req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  };
}

export function requestLogger(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const level = req.path === '/health' ? 'debug' : 'info';
      logger.log(level, 'HTTP request completed', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      });
    });
    next();
  };
}
