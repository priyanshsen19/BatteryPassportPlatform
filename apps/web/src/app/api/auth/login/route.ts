import type { ApiResponse, LoginResult } from '@bpp/shared/schemas';
import { NextResponse, type NextRequest } from 'next/server';
import { callService, requiredEnv, setSessionCookie, withJsonErrors } from '@/lib/server/session';

async function handlePOST(request: NextRequest) {
  const upstream = await callService(`${requiredEnv('AUTH_SERVICE_URL')}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
  });
  if (upstream instanceof NextResponse) return upstream;

  const body = (await upstream.json()) as ApiResponse<LoginResult>;
  if (!body.success) return NextResponse.json(body, { status: upstream.status });

  await setSessionCookie(body.data.token);
  // The token itself stays server-side; the browser only learns who is signed in.
  return NextResponse.json({ success: true, data: { user: body.data.user } });
}

export const POST = withJsonErrors(handlePOST);
