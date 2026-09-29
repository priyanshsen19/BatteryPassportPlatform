import { NextResponse, type NextRequest } from 'next/server';
import { callService, requiredEnv, withJsonErrors } from '@/lib/server/session';

// Leaves time to wait for a sleeping backend service to wake up (see callService).
export const maxDuration = 60;

/** Asks the auth service to email a reset link; the response never reveals whether the account exists. */
async function handlePOST(request: NextRequest) {
  const { email } = (await request.json()) as { email: string };
  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (upstream instanceof NextResponse) return upstream;
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}

export const POST = withJsonErrors(handlePOST);
