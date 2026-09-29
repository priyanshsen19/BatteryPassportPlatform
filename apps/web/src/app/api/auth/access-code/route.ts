import { NextResponse, type NextRequest } from 'next/server';
import { callService, clientIpHeader, requiredEnv, withJsonErrors } from '@/lib/server/session';

// Leaves time to wait for a sleeping backend service to wake up (see callService).
export const maxDuration = 60;

/** Checks an admin access code before sign-up; the auth service limits wrong attempts. */
async function handlePOST(request: NextRequest) {
  const { accessCode } = (await request.json()) as { accessCode: string };
  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/access-code/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...clientIpHeader(request) },
    body: JSON.stringify({ accessCode }),
  });
  if (upstream instanceof NextResponse) return upstream;

  const headers = new Headers();
  const rateLimit = upstream.headers.get('ratelimit');
  if (rateLimit) headers.set('ratelimit', rateLimit);
  return NextResponse.json(await upstream.json(), { status: upstream.status, headers });
}

export const POST = withJsonErrors(handlePOST);
