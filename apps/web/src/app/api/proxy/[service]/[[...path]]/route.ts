import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  callService,
  errorResponse,
  getSessionToken,
  requiredEnv,
  withJsonErrors,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

const SERVICES = {
  passports: { env: 'PASSPORT_SERVICE_URL', prefix: '/api/passports' },
  documents: { env: 'DOCUMENT_SERVICE_URL', prefix: '/api/documents' },
  // User and role management (admin only; enforced by the auth service).
  users: { env: 'AUTH_SERVICE_URL', prefix: '/api/auth/users' },
} as const;

type RouteContext = { params: Promise<{ service: string; path?: string[] }> };

/**
 * Forwards browser requests to the passport and document services, attaching the JWT from
 * the httpOnly session cookie. Authorization is still enforced by the services themselves.
 */
async function forward(request: NextRequest, { params }: RouteContext) {
  const { service, path = [] } = await params;
  const target = SERVICES[service as keyof typeof SERVICES];
  if (!target) return errorResponse(404, 'ROUTE_NOT_FOUND', 'Unknown service');

  const token = await getSessionToken();
  if (!token) return errorResponse(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');

  const suffix = path.map(encodeURIComponent).join('/');
  const url = `${requiredEnv(target.env)}${target.prefix}${suffix ? `/${suffix}` : ''}${request.nextUrl.search}`;

  const headers = new Headers({ authorization: `Bearer ${token}`, 'x-request-id': randomUUID() });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await callService(url, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });
  if (upstream instanceof NextResponse) return upstream;

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'x-request-id': upstream.headers.get('x-request-id') ?? headers.get('x-request-id')!,
    },
  });
}

const handler = withJsonErrors(forward);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
