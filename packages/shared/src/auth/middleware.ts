import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Errors } from '../errors';
import type { AuthUser, Role } from '../schemas/auth';
import './context';

/** Resolves a bearer token to the authenticated user or throws an AppError. */
export type TokenVerifier = (token: string, requestId: string) => Promise<AuthUser>;

export function extractBearerToken(header: string | undefined): string {
  const [scheme, token] = (header ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw Errors.unauthorized('Missing or malformed Authorization header', 'MISSING_TOKEN');
  }
  return token;
}

/**
 * Authenticates the request with the supplied verifier and attaches the user to req.user.
 * The auth service verifies tokens locally; other services verify them over HTTP.
 */
export function createAuthenticateJWT(verify: TokenVerifier): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.get('authorization'));
      req.user = await verify(token, req.requestId);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        Errors.forbidden(`This action requires one of the following roles: ${roles.join(', ')}`, 'INSUFFICIENT_ROLE'),
      );
    }
    return next();
  };
}
