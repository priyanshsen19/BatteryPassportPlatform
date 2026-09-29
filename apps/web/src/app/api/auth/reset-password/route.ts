import { NextResponse, type NextRequest } from 'next/server';
import { callService, clearSessionCookie, requiredEnv, withJsonErrors } from '@/lib/server/session';

/** Sets a new password from an emailed link. Any session in this browser ends, as on every other device. */
async function handlePOST(request: NextRequest) {
  const { token, password } = (await request.json()) as { token: string; password: string };
  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (upstream instanceof NextResponse) return upstream;
  if (upstream.ok) await clearSessionCookie();
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}

export const POST = withJsonErrors(handlePOST);
