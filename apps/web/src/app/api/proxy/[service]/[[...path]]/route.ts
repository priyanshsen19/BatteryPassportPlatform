import { randomUUID } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { log } from '@/lib/server/log';
import {
  callService,
  errorResponse,
  getSessionToken,
  requiredEnv,
  withJsonErrors,
} from '@/lib/server/session';

// Leaves time to wait for a sleeping backend service to wake up (see callService).
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

const SERVICES = {
  passports: { env: 'PASSPORT_SERVICE_URL', prefix: '/api/passports', label: 'Passport service' },
  documents: { env: 'DOCUMENT_SERVICE_URL', prefix: '/api/documents', label: 'Document service' },
  // User and role management (admin only; enforced by the auth service).
  users: { env: 'AUTH_SERVICE_URL', prefix: '/api/auth/users', label: 'Auth service' },
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

  if (!process.env[target.env]?.trim()) {
    log('error', 'Service URL is not configured', { service, env: target.env });
    return errorResponse(503, 'SERVICE_UNAVAILABLE', `${target.label} is not configured (${target.env}).`);
  }

  const suffix = path.map(encodeURIComponent).join('/');
  const url = `${requiredEnv(target.env)}${target.prefix}${suffix ? `/${suffix}` : ''}${request.nextUrl.search}`;

  const requestId = randomUUID();
  const headers = new Headers({ authorization: `Bearer ${token}`, 'x-request-id': requestId });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await callService(url, {
    method: request.method,
    headers,
    // Buffered so the request can be re-sent while a sleeping service wakes up.
    body: hasBody ? await request.arrayBuffer() : undefined,
  });
  if (upstream instanceof NextResponse) {
    return errorResponse(502, 'SERVICE_UNAVAILABLE', `${target.label} is unreachable. Please try again.`);
  }

  // The services always answer with JSON; anything else (e.g. a hosting platform's HTML error
  // page while a service is down or restarting) is reported as the service being unavailable.
  const upstreamType = upstream.headers.get('content-type') ?? '';
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  if (!upstreamType.includes('application/json')) {
    await upstream.body?.cancel();
    log('error', 'Backend service returned a non-JSON response', {
      service,
      url,
      status: upstream.status,
      contentType: upstreamType,
      requestId,
    });
    return errorResponse(
      upstream.status >= 500 ? upstream.status : 502,
      'SERVICE_UNAVAILABLE',
      `${target.label} is unavailable (HTTP ${upstream.status}). Please try again shortly.`,
    );
  }

  if (upstream.status >= 500) {
    log('warn', 'Backend service returned an error', { service, url, status: upstream.status, requestId });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstreamType,
      'x-request-id': upstream.headers.get('x-request-id') ?? requestId,
    },
  });
}

const handler = withJsonErrors(forward);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
