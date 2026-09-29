import { AppError } from '@bpp/shared';
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type RateLimitInfo } from 'express-rate-limit';
import { isIP } from 'net';
import { config, logger } from '../config';

interface LimitOptions {
  name: string;
  limit: number;
  /** Counts per email instead of per client IP. */
  byEmail?: boolean;
  /** One counter for all clients. */
  global?: boolean;
  /** Only failed requests (status >= 400, or `res.locals.accessCodeRejected`) count. */
  failuresOnly?: boolean;
  skip?: (req: Request) => boolean;
}

/**
 * In-memory limiter for one auth endpoint. Limits that protect an account are keyed by email; the
 * others by client IP (the web app forwards the visitor's address in X-Forwarded-For). Counters
 * reset with the process and are per instance, which suits a single auth service instance.
 */
function createLimiter({ name, limit, byEmail, global, failuresOnly, skip }: LimitOptions): RequestHandler {
  const { windowMinutes } = config.rateLimit;
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    // The all-clients cap sends no headers, so clients see their own remaining attempts.
    standardHeaders: global ? false : 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly ?? false,
    requestWasSuccessful: (_req, res) => res.statusCode < 400 && !res.locals.accessCodeRejected,
    skip,
    keyGenerator: global
      ? () => name
      : byEmail
        ? (req: Request) => `${name}:${String(req.body?.email ?? '')}`
        : (req: Request) => `${name}:${clientKey(req)}`,
    handler: (req, _res, next) => {
      const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
      const resetTime = info?.resetTime?.getTime() ?? Date.now() + windowMinutes * 60_000;
      const minutes = Math.max(1, Math.ceil((resetTime - Date.now()) / 60_000));
      logger.warn('Rate limit reached', { limiter: name, requestId: req.requestId });
      next(
        new AppError(
          429,
          'TOO_MANY_REQUESTS',
          `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        ),
      );
    },
  });
}

const RESET_PASSWORD_MAX_FAILED_ATTEMPTS = 10;
const ACCESS_CODE_MAX_FAILED_ATTEMPTS_ALL_CLIENTS = 30;

const hasNoAccessCode = (req: Request) => req.body?.accessCode === undefined;

/**
 * The visitor's address: forwarded by the web app in `x-client-ip` (its requests all come from the
 * web servers), otherwise the connecting client. The header can be forged by direct API callers,
 * which is why wrong access codes also have a cap across all clients.
 */
function clientKey(req: Request): string {
  const forwarded = req.get('x-client-ip')?.trim();
  return ipKeyGenerator(forwarded && isIP(forwarded) ? forwarded : (req.ip ?? 'unknown'));
}

export function createRateLimits() {
  const limits = config.rateLimit;
  return {
    /** Failed logins per email: slows password guessing against one account. */
    login: createLimiter({
      name: 'login',
      limit: limits.loginMaxFailedAttempts,
      byEmail: true,
      failuresOnly: true,
    }),
    /** Reset emails per address: stops the endpoint being used to flood an inbox. */
    forgotPassword: createLimiter({
      name: 'forgot-password',
      limit: limits.passwordResetMaxRequests,
      byEmail: true,
    }),
    /** Failed reset attempts per client. */
    resetPassword: createLimiter({
      name: 'reset-password',
      limit: RESET_PASSWORD_MAX_FAILED_ATTEMPTS,
      failuresOnly: true,
    }),
    /**
     * Wrong access codes, shared by code verification and registration: a few per client, plus a
     * cap across all clients so the code cannot be guessed from many addresses. Requests without
     * a code are never counted.
     */
    accessCode: [
      createLimiter({
        name: 'access-code',
        limit: limits.accessCodeMaxFailedAttempts,
        failuresOnly: true,
        skip: hasNoAccessCode,
      }),
      createLimiter({
        name: 'access-code-all-clients',
        limit: ACCESS_CODE_MAX_FAILED_ATTEMPTS_ALL_CLIENTS,
        failuresOnly: true,
        skip: hasNoAccessCode,
        global: true,
      }),
    ],
  };
}
