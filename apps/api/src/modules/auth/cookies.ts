/**
 * The refresh token as a browser cookie.
 *
 * Closes security review S-5. The console kept its refresh token in
 * `sessionStorage`, where any script running on the origin can read it — so a
 * single XSS yielded a 30-day renewable credential. An httpOnly cookie cannot
 * be read by script at all.
 *
 * S-5 was deliberately deferred until S-1 landed, because a cookie you cannot
 * revoke is barely better than storage you can read. Sessions exist now, so
 * this is worth doing.
 *
 * THE HALF THAT IS EASY TO MISS: moving the token into an httpOnly cookie buys
 * nothing on its own if the login and refresh responses still carry the token
 * in their body. An XSS would simply call /auth/refresh — the cookie rides
 * along automatically — and read the answer. So cookie mode also STRIPS the
 * refresh token from the response body. The two changes are one change.
 */

/** Name is prefixed so it cannot be set by a subdomain over plain HTTP. */
export const REFRESH_COOKIE = 'maya_refresh'

/**
 * Only the auth routes ever need it, so nothing else carries it.
 *
 * A cookie scoped to `/` would be attached to every catalog read and every
 * artifact download, which is a lot of chances to log or cache a credential
 * that those requests never use.
 */
const COOKIE_PATH = '/v1/auth'

/** Matches the refresh token's own lifetime — see SessionService. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export interface CookieOptions {
  /** Off in local development, where there is no TLS to require. */
  secure: boolean
}

/**
 * Reads one cookie out of a raw `Cookie` header.
 *
 * Hand-parsed rather than pulling in cookie-parser: this package types request
 * objects structurally instead of depending on @types/express, and one named
 * cookie does not justify middleware. Values are decoded because a token is
 * base64url with `.` separators — safe as-is, but a caller should not have to
 * know that.
 */
export const readCookie = (header: string | undefined, name: string): string | null => {
  if (!header) return null

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() !== name) continue

    const raw = part.slice(index + 1).trim()
    try {
      return decodeURIComponent(raw) || null
    } catch {
      // A malformed percent-escape is not our token.
      return null
    }
  }
  return null
}

const serialise = (value: string, maxAge: number, options: CookieOptions): string => {
  const parts = [
    `${REFRESH_COOKIE}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    /*
     * Strict, not Lax. A refresh endpoint is exactly what a cross-site request
     * would want to hit: with rotation live, an attacker who can make the
     * browser refresh does not learn the token — CORS stops them reading the
     * reply — but they DO rotate it, which makes the real tab's next refresh
     * look like a replay and revokes the whole chain. That is a logout button
     * any website could press.
     *
     * Strict requires the console and the API to be same-site (ports do not
     * count, so localhost:5173 and localhost:3000 qualify, as do
     * maya.example.com and api.example.com). An API on a genuinely different
     * registrable domain would need SameSite=None, which requires Secure.
     */
    'SameSite=Strict',
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

export const setRefreshCookie = (token: string, options: CookieOptions): string =>
  serialise(token, MAX_AGE_SECONDS, options)

/**
 * Expiry must repeat Path and SameSite exactly, or the browser treats it as a
 * different cookie and quietly leaves the original in place.
 */
export const clearRefreshCookie = (options: CookieOptions): string =>
  serialise('', 0, options)
