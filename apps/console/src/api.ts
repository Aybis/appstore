/**
 * Console API client.
 *
 * TOKEN STORAGE — S-5, closed.
 *
 * The access token lives in memory and dies with the page. The refresh token
 * is not here at all: the server puts it in an httpOnly cookie this code
 * cannot read, and the browser attaches it to the auth routes on its own.
 *
 * It used to sit in `sessionStorage`, where any script on this origin could
 * read it — so one XSS yielded a 30-day renewable credential. That was left
 * deliberately until S-1 shipped, because a cookie nobody can revoke is barely
 * better than storage anyone can read. Sessions exist now, so the cookie is
 * strictly better and this file no longer touches the token.
 *
 * Note what that costs: there is no longer any way to ask "do I have a
 * session?" without asking the server. The boot path in auth.tsx simply
 * attempts a refresh and believes the answer.
 */

import { config } from './config'

let accessToken: string | null = null

/**
 * Asks the server for cookie mode.
 *
 * Absent, the API replies the way the mobile app needs — refresh token in the
 * body. Sending it moves the token into an httpOnly cookie AND removes it from
 * the response, which are the same change: leaving it in the body would let an
 * XSS call refresh and read the token straight out of the reply.
 */
const COOKIE_MODE = { 'X-Auth-Mode': 'cookie' } as const

/** The cookie is Path-scoped to /v1/auth, so only these calls need to send it. */
const AUTH_INIT: RequestInit = { credentials: 'include' }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const session = {
  get access(): string | null {
    return accessToken
  },
  set(tokens: { accessToken: string }): void {
    accessToken = tokens.accessToken
  },
  clear(): void {
    accessToken = null
  },
}

const messageFrom = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) return body.message.join(', ')
    return body.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

/**
 * One retry after a refresh, never more.
 *
 * A loop here is how a console ends up hammering /auth/refresh with a dead
 * token: the retry fails the same way, refreshes again, and so on. One attempt
 * covers the only case worth covering — an access token that expired while the
 * tab was open.
 */
const request = async <T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> => {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
    ...init,
    headers,
  })

  /*
   * Retried unconditionally on a 401 rather than only when a stored token
   * exists — there is nothing stored to check any more. Either the cookie is
   * there and valid, in which case this recovers, or it is not and refresh
   * fails once.
   */
  if (response.status === 401 && !retried) {
    const refreshed = await refresh()
    if (refreshed) return request<T>(path, init, true)
  }

  if (!response.ok) throw new ApiError(response.status, await messageFrom(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * The one in-flight refresh, shared by every caller that needs it.
 *
 * This is not an optimisation — it is required for correctness now that the
 * server rotates refresh tokens and treats a rotated token presented twice as
 * a stolen one. Two requests 401ing together would each refresh with the SAME
 * token; the first rotates it, the second looks exactly like a replay, and the
 * server revokes the whole chain. The user gets signed out for loading two
 * panels at once.
 */
let inFlight: Promise<boolean> | null = null

const runRefresh = async (): Promise<boolean> => {
  const response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`, {
    ...AUTH_INIT,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...COOKIE_MODE },
    // The token rides in the cookie; the body carries nothing.
    body: '{}',
  })

  if (!response.ok) {
    // A refused refresh is terminal: revoked, expired, or replayed.
    session.clear()
    return false
  }

  session.set((await response.json()) as { accessToken: string })
  return true
}

export const refresh = async (): Promise<boolean> => {
  // Late arrivals join the running attempt rather than starting a second one.
  inFlight ??= runRefresh().finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * Ends the session on the SERVER, not just in this tab.
 *
 * Clearing local storage alone leaves the refresh token live for its full
 * 30-day life — which is precisely the gap the sessions table was built to
 * close, so a console that only forgets its own copy would quietly undo it.
 */
export const logout = async (): Promise<void> => {
  session.clear()

  try {
    await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/logout`, {
      ...AUTH_INIT,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...COOKIE_MODE },
      body: '{}',
    })
  } catch {
    // The local session is already gone; a failed network call must not leave
    // the user looking signed in. The server-side session is what grants
    // anything, and the next refresh will fail.
  }
}

/** Sign-in. Separate from `api.post` because it opts into cookie mode. */
export const login = async <T>(body: unknown): Promise<T> => {
  const response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/login`, {
    ...AUTH_INIT,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...COOKIE_MODE },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, await messageFrom(response))
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
