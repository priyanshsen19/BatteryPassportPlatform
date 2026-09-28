import 'server-only';
import type { ApiFailure } from '@bpp/shared/schemas';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'bpp_session';

export function requiredEnv(
  name: 'AUTH_SERVICE_URL' | 'PASSPORT_SERVICE_URL' | 'DOCUMENT_SERVICE_URL',
): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value.replace(/\/$/, '');
}

/** Seconds until the JWT's exp claim, so the cookie never outlives the token. */
function secondsUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (payload.exp) return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    // fall through to the default
  }
  return 60 * 60;
}

/**
 * The JWT is kept in an httpOnly cookie: browser scripts cannot read it, and the Next.js
 * server attaches it when forwarding API calls to the services.
 */
export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntilExpiry(token),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export function errorResponse(status: number, code: string, message: string): NextResponse<ApiFailure> {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Calls a backend service, mapping network failures to a 502 envelope. */
export async function callService(
  url: string,
  init: RequestInit,
): Promise<Response | NextResponse<ApiFailure>> {
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  } catch {
    return errorResponse(
      502,
      'SERVICE_UNAVAILABLE',
      'The service is currently unavailable. Please try again.',
    );
  }
}
