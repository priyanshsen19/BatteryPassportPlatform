import { AppError, Errors } from '../errors';
import type { Logger } from '../logger';
import type { AuthUser } from '../schemas/auth';
import type { ApiFailure, ApiSuccess } from '../schemas/common';
import type { TokenVerifier } from './middleware';

export interface AuthServiceClientOptions {
  baseUrl: string;
  timeoutMs: number;
  logger: Logger;
}

export interface AuthServiceClient {
  verifyToken: TokenVerifier;
}

/**
 * Synchronous service-to-service call to the Auth Service: validates a JWT and returns the
 * caller's current identity and role. Consuming services never hold the JWT secret.
 */
export function createAuthServiceClient({ baseUrl, timeoutMs, logger }: AuthServiceClientOptions): AuthServiceClient {
  const meUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/me`;

  return {
    async verifyToken(token, requestId) {
      let response: Response;
      try {
        response = await fetch(meUrl, {
          headers: { authorization: `Bearer ${token}`, 'x-request-id': requestId },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        logger.error('Auth service request failed', { requestId, error: (err as Error).message });
        throw Errors.serviceUnavailable('AUTH_SERVICE_UNAVAILABLE', 'Authentication service is unavailable');
      }

      if (response.status === 401) {
        const body = (await response.json().catch(() => null)) as ApiFailure | null;
        throw new AppError(401, body?.error.code ?? 'INVALID_TOKEN', body?.error.message ?? 'Invalid or expired token');
      }

      if (!response.ok) {
        logger.error('Auth service returned an unexpected status', { requestId, status: response.status });
        throw Errors.badGateway('AUTH_SERVICE_ERROR', 'Authentication service returned an unexpected response');
      }

      const body = (await response.json()) as ApiSuccess<{ user: AuthUser }>;
      return body.data.user;
    },
  };
}
