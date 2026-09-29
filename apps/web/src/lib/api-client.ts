import type { ApiResponse, ErrorDetail } from '@bpp/shared/schemas';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let redirectingToLogin = false;

/** Session expired or revoked: clear the cookie and send the user back to sign in. */
async function handleUnauthenticated(): Promise<void> {
  if (redirectingToLogin || typeof window === 'undefined') return;
  redirectingToLogin = true;
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  window.location.assign(`/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
}

export function toApiError(status: number, body: unknown): ApiError {
  const failure = body as Extract<ApiResponse<unknown>, { success: false }> | null;
  if (failure && failure.success === false) {
    return new ApiError(status, failure.error.code, failure.error.message, failure.error.details);
  }
  return new ApiError(status, 'UNEXPECTED_RESPONSE', 'Something went wrong. Please try again.');
}

export async function parseResponse<T>(response: Response, { redirectOn401 = true } = {}): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (response.ok && body?.success) return body.data;
  if (response.status === 401 && redirectOn401) void handleUnauthenticated();
  throw toApiError(response.status, body);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection.');
  }
  return parseResponse<T>(response);
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** Calls the passport/document services through the authenticated Next.js proxy. */
export const api = {
  get: <T>(path: string) => request<T>(`/api/proxy${path}`),
  post: <T>(path: string, body: unknown) => request<T>(`/api/proxy${path}`, json('POST', body)),
  put: <T>(path: string, body: unknown) => request<T>(`/api/proxy${path}`, json('PUT', body)),
  patch: <T>(path: string, body: unknown) => request<T>(`/api/proxy${path}`, json('PATCH', body)),
  delete: <T>(path: string) => request<T>(`/api/proxy${path}`, { method: 'DELETE' }),
};

export const authApi = {
  login: (body: unknown) =>
    fetch('/api/auth/login', json('POST', body)).then((r) =>
      parseResponse<{ user: unknown }>(r, { redirectOn401: false }),
    ),
  register: (body: unknown) =>
    fetch('/api/auth/register', json('POST', body)).then((r) =>
      parseResponse<{ user: unknown }>(r, { redirectOn401: false }),
    ),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }),
};
