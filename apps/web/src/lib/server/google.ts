import 'server-only';
import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';

export const OAUTH_COOKIE = 'bpp_google_oauth';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * The origin users see. Inside a container `request.url` reflects the bind address
 * (e.g. 0.0.0.0:3000), so PUBLIC_APP_URL wins, then the forwarded/Host headers.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

/** Google sign-in is optional: it is only enabled when both OAuth client settings are present. */
export function googleConfig(request: NextRequest): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${publicOrigin(request)}/api/auth/google/callback` };
}

const base64Url = (buffer: Buffer) => buffer.toString('base64url');

/** State (CSRF protection) and PKCE verifier for one sign-in attempt. */
export function createOAuthAttempt(next: string) {
  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  return { state, codeVerifier, codeChallenge, next };
}

export function authorizationUrl(config: GoogleOAuthConfig, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** Exchanges the authorization code for tokens and returns Google's ID token. */
export async function exchangeCodeForIdToken(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!response.ok || !body.id_token)
    throw new Error(body.error ?? `Token exchange failed (${response.status})`);
  return body.id_token;
}
