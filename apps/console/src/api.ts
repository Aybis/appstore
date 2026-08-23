/**
 * Console API client.
 *
 * TOKEN STORAGE — an interim state, recorded rather than hidden.
 *
 * The access token is held in memory only. The refresh token goes to
 * `sessionStorage`, so it dies with the tab rather than persisting to disk like
 * `localStorage` would.
 *
 * The security review (docs/07-console/security-review.md, S-1 and S-5) calls
 * for the refresh token to live in an httpOnly, Secure, SameSite cookie instead.
 * That is strictly better — JavaScript cannot read it, so an XSS on this origin
 * cannot steal it — but it depends on the `sessions` table that does not exist
 * yet, because a cookie you cannot revoke is barely better than storage you can
 * read. Until S-1 lands, sessionStorage is the smallest exposure available: it
 * survives a page reload, which a CMS that uploads large files genuinely needs,
 * and nothing else.
 */

import { config } from './config'

const REFRESH_KEY = 'maya.console.refresh'

let accessToken: string | null = null

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
  get refresh(): string | null {
    return sessionStorage.getItem(REFRESH_KEY)
  },
  set(tokens: { accessToken: string; refreshToken: string }): void {
    accessToken = tokens.accessToken
    sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  },
  clear(): void {
    accessToken = null
    sessionStorage.removeItem(REFRESH_KEY)
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

  if (response.status === 401 && !retried && session.refresh) {
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
  const token = session.refresh
  if (!token) return false

  const response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  })

  if (!response.ok) {
    // A refused refresh is terminal: revoked, expired, or replayed. Keeping
    // the dead token would make every later request retry against it.
    session.clear()
    return false
  }

  session.set((await response.json()) as { accessToken: string; refreshToken: string })
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
  const token = session.refresh
  session.clear()
  if (!token) return

  try {
    await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    })
  } catch {
    // The local session is already gone; a failed network call must not leave
    // the user looking signed in.
  }
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
