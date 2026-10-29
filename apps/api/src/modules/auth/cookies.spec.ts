import { describe, expect, it } from 'vitest'
import { clearRefreshCookie, readCookie, REFRESH_COOKIE, setRefreshCookie } from './cookies'

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; maya_refresh=tok; b=2', REFRESH_COOKIE)).toBe('tok')
  })

  it('tolerates missing spaces and odd padding', () => {
    expect(readCookie('a=1;maya_refresh=tok', REFRESH_COOKIE)).toBe('tok')
    expect(readCookie('  maya_refresh = tok  ', REFRESH_COOKIE)).toBe('tok')
  })

  it('does not match a cookie whose name merely ends the same way', () => {
    // The bug this prevents: a naive includes() would read `evil_maya_refresh`.
    expect(readCookie('evil_maya_refresh=nope', REFRESH_COOKIE)).toBeNull()
  })

  it('returns null for absent, empty and malformed headers', () => {
    expect(readCookie(undefined, REFRESH_COOKIE)).toBeNull()
    expect(readCookie('', REFRESH_COOKIE)).toBeNull()
    expect(readCookie('maya_refresh=', REFRESH_COOKIE)).toBeNull()
    expect(readCookie('novalue', REFRESH_COOKIE)).toBeNull()
    expect(readCookie('maya_refresh=%E0%A4%A', REFRESH_COOKIE)).toBeNull()
  })

  it('round-trips a value through the writer', () => {
    const header = setRefreshCookie('a.b-c_d', { secure: true })
    const value = header.slice(header.indexOf('=') + 1, header.indexOf(';'))
    expect(readCookie(`${REFRESH_COOKIE}=${value}`, REFRESH_COOKIE)).toBe('a.b-c_d')
  })
})

describe('setRefreshCookie', () => {
  const header = setRefreshCookie('tok', { secure: true })

  it('is unreadable by script and scoped to the auth routes only', () => {
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Path=/v1/auth')
  })

  it('is Strict, so no other site can trigger a rotation', () => {
    expect(header).toContain('SameSite=Strict')
  })

  it('lives as long as the refresh token does', () => {
    expect(header).toContain(`Max-Age=${30 * 24 * 60 * 60}`)
  })

  it('omits Secure only when told to, for local development', () => {
    expect(header).toContain('Secure')
    expect(setRefreshCookie('tok', { secure: false })).not.toContain('Secure')
  })
})

describe('clearRefreshCookie', () => {
  it('expires immediately', () => {
    expect(clearRefreshCookie({ secure: true })).toContain('Max-Age=0')
  })

  it('repeats Path and SameSite, or the browser expires a different cookie', () => {
    const cleared = clearRefreshCookie({ secure: true })
    expect(cleared).toContain('Path=/v1/auth')
    expect(cleared).toContain('SameSite=Strict')
  })
})
