import { BASE_URL } from './config';

/**
 * Milestone 15 Phase 1 — a small real-HTTP client for the demo-content
 * build script, mirroring `apps/api/src/load-test/http-load-test.ts`'s
 * "real fetch() calls against a running dev server" approach. Every call
 * here goes through the actual NestJS app (guards, validation, service
 * layer, wiki-link/audit/search-vector side effects) rather than a raw DB
 * write — see `seed-perf.ts`'s doc comment for why that matters for
 * content that needs backlinks/search to actually work.
 */

export class ApiError extends Error {
  constructor(
    method: string,
    path: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`${method} ${path} -> ${status}: ${JSON.stringify(body)}`);
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(method, path, res.status, parsed);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>('GET', path, { token }),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>('POST', path, { token, body }),
  patch: <T>(path: string, body?: unknown, token?: string) =>
    request<T>('PATCH', path, { token, body }),
  delete: <T>(path: string, token?: string) =>
    request<T>('DELETE', path, { token }),
};

export interface AuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email: string; displayName: string };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  await api.post('/auth/register', { email, password, displayName });
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token });
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  const res = await api.post<AuthTokenResponse>('/auth/login', {
    email,
    password,
  });
  return { token: res.accessToken, userId: res.user.id };
}

/** Raw PUT straight to the presigned storage URL — not a JSON API call, so
 * it bypasses `request()`/`api`. Same shape as
 * `apps/api/test/attachments.e2e-spec.ts`'s real presign -> PUT -> complete
 * flow. */
export async function uploadBytes(
  uploadUrl: string,
  bytes: Buffer,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(`PUT ${uploadUrl} -> ${res.status}`);
  }
}
