import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, it } from 'vitest'
import { JwtGuard } from './jwt.guard'
import { IS_PUBLIC_KEY } from './public.decorator'
import { TokenService } from './token.service'

const SECRET = 'a'.repeat(32)

const claims = {
  sub: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'publisher' as const,
}

interface FakeRequest {
  headers: { authorization?: string }
  auth?: unknown
}

/**
 * Key-aware: distinguishes `IS_PUBLIC_KEY` from anything else, so a test
 * that isn't exercising `@Public()` can't accidentally short-circuit the
 * guard by returning a truthy value for the wrong metadata key.
 */
function fakeReflector(isPublic = false): Reflector {
  return {
    getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? isPublic : undefined),
  } as unknown as Reflector
}

function makeContext(headers: FakeRequest['headers']): { context: ExecutionContext; request: FakeRequest } {
  const request: FakeRequest = { headers }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
  return { context, request }
}

function makeGuard(isPublic = false): JwtGuard {
  return new JwtGuard(new TokenService(new JwtService({ secret: SECRET })), fakeReflector(isPublic))
}

describe('JwtGuard', () => {
  it('populates request.auth from a valid bearer access token', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens, fakeReflector())
    const pair = await tokens.issue(claims)
    const { context, request } = makeContext({ authorization: `Bearer ${pair.accessToken}` })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth).toMatchObject(claims)
  })

  it('rejects a missing authorization header', async () => {
    const { context } = makeContext({})
    await expect(makeGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a header without the Bearer scheme', async () => {
    const { context } = makeContext({ authorization: 'Basic somevalue' })
    await expect(makeGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a refresh token presented as an access token', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens, fakeReflector())
    const pair = await tokens.issue(claims)
    const { context } = makeContext({ authorization: `Bearer ${pair.refreshToken}` })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepts a lowercase "bearer" scheme (RFC 7235 case-insensitivity)', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens, fakeReflector())
    const pair = await tokens.issue(claims)
    const { context, request } = makeContext({ authorization: `bearer ${pair.accessToken}` })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth).toMatchObject(claims)
  })

  it('allows a @Public() route with no Authorization header at all, and never sets request.auth (round 1, M4)', async () => {
    const guard = makeGuard(true)
    const { context, request } = makeContext({})

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth).toBeUndefined()
  })

  it('still enforces a bearer token on a non-public route (isPublic explicitly false)', async () => {
    const guard = makeGuard(false)
    const { context } = makeContext({})

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
