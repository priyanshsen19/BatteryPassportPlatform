import { NextResponse, type NextRequest } from 'next/server';
import {
  callService,
  clearSessionCookie,
  clientIpHeader,
  requiredEnv,
  withJsonErrors,
} from '@/lib/server/session';

// Leaves time to wait for a sleeping backend service to wake up (see callService).
export const maxDuration = 60;

/** Sets a new password from an emailed link. Any session in this browser ends, as on every other device. */
async function handlePOST(request: NextRequest) {
  const { token, password } = (await request.json()) as { token: string; password: string };
  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...clientIpHeader(request) },
    body: JSON.stringify({ token, password }),
  });
  if (upstream instanceof NextResponse) return upstream;
  if (upstream.ok) await clearSessionCookie();
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}

export const POST = withJsonErrors(handlePOST);
