import type { ApiResponse, LoginResult } from '@bpp/shared/schemas';
import { NextResponse, type NextRequest } from 'next/server';
import { OAUTH_COOKIE, exchangeCodeForIdToken, googleConfig, publicOrigin } from '@/lib/server/google';
import { errorMessage, log } from '@/lib/server/log';
import { callService, requiredEnv, setSessionCookie } from '@/lib/server/session';

// Leaves time to wait for a sleeping backend service to wake up (see callService).
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

interface StoredAttempt {
  state: string;
  codeVerifier: string;
  next: string;
}

function readAttempt(request: NextRequest): StoredAttempt | null {
  try {
    return JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? '') as StoredAttempt;
  } catch {
    return null;
  }
}

const PASSED_THROUGH_ERRORS = new Set(['GOOGLE_EMAIL_UNVERIFIED', 'ACCOUNT_LINKED_ELSEWHERE']);

/**
 * Google redirects here after consent. We check the state, exchange the code (with the PKCE
 * verifier) for an ID token, and let the auth service verify it and issue the platform JWT.
 *
 * Every outcome is an HTTP redirect. An unhandled exception would otherwise produce a bare 500
 * with no Content-Type, which Safari saves as a file named "callback" instead of showing it.
 */
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = publicOrigin(request);
  } catch {
    origin = request.nextUrl.origin;
  }

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' });
    return response;
  };
  const fail = (reason: string, meta: Record<string, unknown> = {}) => {
    log('warn', 'Google sign-in failed', { reason, ...meta });
    return redirectTo(`/login?error=${reason}`);
  };

  try {
    const config = googleConfig(request);
    if (!config) return fail('google_unavailable');

    const params = request.nextUrl.searchParams;
    const googleError = params.get('error');
    if (googleError) return fail('google_cancelled', { googleError });

    const attempt = readAttempt(request);
    const code = params.get('code');
    if (!attempt) return fail('google_failed', { step: 'state', detail: 'OAuth cookie missing or expired' });
    if (!code || params.get('state') !== attempt.state) {
      return fail('google_failed', { step: 'state', detail: 'state mismatch or missing code' });
    }

    let idToken: string;
    try {
      idToken = await exchangeCodeForIdToken(config, code, attempt.codeVerifier);
    } catch (err) {
      return fail('google_failed', { step: 'token_exchange', error: errorMessage(err) });
    }

    const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (upstream instanceof NextResponse) return fail('google_failed', { step: 'auth_service_unreachable' });

    const body = (await upstream.json().catch(() => null)) as ApiResponse<LoginResult> | null;
    if (!body?.success) {
      const errorCode = body?.error.code;
      return fail(
        errorCode && PASSED_THROUGH_ERRORS.has(errorCode) ? errorCode.toLowerCase() : 'google_failed',
        {
          step: 'auth_service',
          status: upstream.status,
          errorCode,
        },
      );
    }

    await setSessionCookie(body.data.token);
    log('info', 'Google sign-in completed', { userId: body.data.user.id });
    return redirectTo(attempt.next);
  } catch (err) {
    log('error', 'Google sign-in callback crashed', { error: errorMessage(err) });
    return redirectTo('/login?error=google_failed');
  }
}
