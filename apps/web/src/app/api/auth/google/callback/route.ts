import type { ApiResponse, LoginResult } from '@bpp/shared/schemas';
import { NextResponse, type NextRequest } from 'next/server';
import { OAUTH_COOKIE, exchangeCodeForIdToken, googleConfig, publicOrigin } from '@/lib/server/google';
import { callService, requiredEnv, setSessionCookie } from '@/lib/server/session';

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

/**
 * Google redirects here after consent. We check the state, exchange the code (with the PKCE
 * verifier) for an ID token, and let the auth service verify it and issue the platform JWT.
 */
export async function GET(request: NextRequest) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${publicOrigin(request)}/login?error=${reason}`);
    response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' });
    return response;
  };

  const config = googleConfig(request);
  if (!config) return fail('google_unavailable');

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail('google_cancelled');

  const attempt = readAttempt(request);
  const code = params.get('code');
  if (!attempt || !code || params.get('state') !== attempt.state) return fail('google_failed');

  let idToken: string;
  try {
    idToken = await exchangeCodeForIdToken(config, code, attempt.codeVerifier);
  } catch {
    return fail('google_failed');
  }

  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/google`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (upstream instanceof NextResponse) return fail('google_failed');

  const body = (await upstream.json().catch(() => null)) as ApiResponse<LoginResult> | null;
  if (!body?.success) {
    const code = body?.error.code;
    return fail(
      code === 'GOOGLE_EMAIL_UNVERIFIED' || code === 'ACCOUNT_LINKED_ELSEWHERE'
        ? code.toLowerCase()
        : 'google_failed',
    );
  }

  await setSessionCookie(body.data.token);
  const response = NextResponse.redirect(`${publicOrigin(request)}${attempt.next}`);
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' });
  return response;
}
