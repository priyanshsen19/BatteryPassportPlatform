import { NextResponse } from 'next/server';
import {
  callService,
  clearSessionCookie,
  errorResponse,
  getSessionToken,
  requiredEnv,
  withJsonErrors,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Resolves the signed-in user by verifying the session token with the Auth Service. */
async function handleGET() {
  const token = await getSessionToken();
  if (!token) return errorResponse(401, 'UNAUTHENTICATED', 'You are not signed in');

  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (upstream instanceof NextResponse) return upstream;

  if (upstream.status === 401) await clearSessionCookie();
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}

export const GET = withJsonErrors(handleGET);
