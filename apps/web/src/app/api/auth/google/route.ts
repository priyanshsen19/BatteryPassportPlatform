import { NextResponse, type NextRequest } from 'next/server';
import {
  OAUTH_COOKIE,
  authorizationUrl,
  createOAuthAttempt,
  googleConfig,
  publicOrigin,
} from '@/lib/server/google';

export const dynamic = 'force-dynamic';

const safeNext = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

/** Starts Google sign-in: stores state + PKCE verifier in a short-lived cookie and redirects. */
export function GET(request: NextRequest) {
  const config = googleConfig(request);
  if (!config) return NextResponse.redirect(`${publicOrigin(request)}/login?error=google_unavailable`);

  const attempt = createOAuthAttempt(safeNext(request.nextUrl.searchParams.get('next')));
  const response = NextResponse.redirect(authorizationUrl(config, attempt.state, attempt.codeChallenge));
  response.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({ state: attempt.state, codeVerifier: attempt.codeVerifier, next: attempt.next }),
    {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 10 * 60,
    },
  );
  return response;
}
