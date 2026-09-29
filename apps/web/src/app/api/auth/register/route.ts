import type { ApiResponse, LoginResult } from '@bpp/shared/schemas';
import { NextResponse, type NextRequest } from 'next/server';
import { callService, requiredEnv, setSessionCookie, withJsonErrors } from '@/lib/server/session';

/** Registers the account, then signs it in so the user lands directly in the app. */
async function handlePOST(request: NextRequest) {
  const authUrl = requiredEnv('AUTH_SERVICE_URL');
  const payload = await request.text();

  const registered = await callService(`${authUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  });
  if (registered instanceof NextResponse) return registered;
  if (!registered.ok) return NextResponse.json(await registered.json(), { status: registered.status });

  const { email, password } = JSON.parse(payload) as { email: string; password: string };
  const login = await callService(`${authUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (login instanceof NextResponse) return login;

  const body = (await login.json()) as ApiResponse<LoginResult>;
  if (!body.success) return NextResponse.json(body, { status: login.status });

  await setSessionCookie(body.data.token);
  return NextResponse.json({ success: true, data: { user: body.data.user } }, { status: 201 });
}

export const POST = withJsonErrors(handlePOST);
