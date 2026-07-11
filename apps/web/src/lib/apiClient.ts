const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type AccessTokenGetter = () => string | null
type UnauthorizedHandler = () => Promise<string | null>

let getAccessToken: AccessTokenGetter = () => null
let onUnauthorized: UnauthorizedHandler = () => Promise.resolve(null)

/** Wires the client to the app's auth state without a circular import — see features/auth/session.ts. */
export function configureApiClient(options: {
  getAccessToken: AccessTokenGetter
  onUnauthorized: UnauthorizedHandler
}): void {
  getAccessToken = options.getAccessToken
  onUnauthorized = options.onUnauthorized
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  body?: unknown
  /** Set for the refresh call itself, to avoid retry-looping on its own 401. */
  skipAuthRetry?: boolean
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const token = getAccessToken()
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawFetch(path, options)

  if (response.status === 401 && !options.skipAuthRetry) {
    const newToken = await onUnauthorized()
    if (newToken) {
      response = await rawFetch(path, options)
    }
  }

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = undefined
    }
    const message = (body as { message?: string } | undefined)?.message ?? `Request to ${path} failed`
    throw new ApiError(message, response.status, body)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiGet = <T>(path: string): Promise<T> => apiRequest<T>(path)
export const apiPost = <T>(path: string, body?: unknown, options?: Pick<RequestOptions, 'skipAuthRetry'>): Promise<T> =>
  apiRequest<T>(path, { method: 'POST', body, ...options })
export const apiDelete = <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'DELETE' })
