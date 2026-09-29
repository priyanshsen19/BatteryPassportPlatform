import 'server-only';
import type { ApiFailure } from '@bpp/shared/schemas';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { errorMessage, log } from './log';

const SESSION_COOKIE = 'bpp_session';

/** Service base URL from the environment, tolerant of stray whitespace and trailing slashes. */
export function requiredEnv(
  name: 'AUTH_SERVICE_URL' | 'PASSPORT_SERVICE_URL' | 'DOCUMENT_SERVICE_URL',
): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value.replace(/\/+$/, '');
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

/**
 * Wraps a route handler so unexpected errors (e.g. a missing service URL) are logged and
 * returned as the standard JSON error envelope instead of an empty 500.
 */
export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      log('error', 'Route handler failed', { error: errorMessage(err) });
      return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
  };
}

// Fits inside the routes' 60 s maxDuration (the limit on every Vercel plan).
const WAKE_UP_WINDOW_MS = 50_000;
const WAKE_UP_RETRY_MS = 2_500;

/**
 * Free hosting instances sleep when idle. While one starts, the platform itself answers with an
 * HTML 502/503/504 page: the request never reached the service, so sending it again is safe.
 * Our services always answer with JSON, which is how the two cases are told apart.
 */
function isPlatformWakeUpResponse(response: Response): boolean {
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  return !isJson && [502, 503, 504].includes(response.status);
}

/**
 * Calls a backend service, waiting (up to about a minute) for a sleeping service to wake up, and
 * mapping network failures to a 502 envelope. `init.body` must be re-sendable (string or buffer).
 */
export async function callService(
  url: string,
  init: RequestInit,
  timeoutMs = 55_000,
): Promise<Response | NextResponse<ApiFailure>> {
  const deadline = Date.now() + WAKE_UP_WINDOW_MS;
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      log('error', 'Backend service request failed', { url, error: errorMessage(err) });
      return errorResponse(
        502,
        'SERVICE_UNAVAILABLE',
        'The service is currently unavailable. Please try again.',
      );
    }
    if (!isPlatformWakeUpResponse(response) || Date.now() + WAKE_UP_RETRY_MS > deadline) return response;

    await response.body?.cancel();
    if (attempt === 1)
      log('info', 'Backend service is starting up; waiting for it', { url, status: response.status });
    await new Promise((resolve) => setTimeout(resolve, WAKE_UP_RETRY_MS));
  }
}

const WAKE_SERVICE_URLS = [
  'AUTH_SERVICE_URL',
  'PASSPORT_SERVICE_URL',
  'DOCUMENT_SERVICE_URL',
  // Optional: only used to wake the Kafka consumer so notifications are processed promptly.
  'NOTIFICATION_SERVICE_URL',
] as const;
const WAKE_INTERVAL_MS = 60_000;
let lastWake = 0;

/**
 * Sends one request to each backend's /health so services that sleep when idle start booting
 * before they are needed. At most once a minute per server instance. The returned promise settles
 * once every service has received the request (not when it has finished starting).
 */
export async function wakeServices(): Promise<void> {
  if (Date.now() - lastWake < WAKE_INTERVAL_MS) return;
  lastWake = Date.now();
  await Promise.allSettled(
    WAKE_SERVICE_URLS.map((name) => process.env[name]?.trim().replace(/\/+$/, ''))
      .filter((base): base is string => Boolean(base))
      .map((base) =>
        fetch(`${base}/health`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }).then((r) =>
          r.body?.cancel(),
        ),
      ),
  );
}
