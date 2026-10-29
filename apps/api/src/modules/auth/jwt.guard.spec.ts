import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, it } from 'vitest'
import type { ApiKeysService } from './api-keys.service'
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
  /**
   * Typed rather than `unknown` so the machine-credential assertions can read
   * `kind` — the marker RolesGuard uses to skip a membership re-read that
   * would 403 every CI request.
   */
  auth?: { sub?: string; orgId?: string; role?: string; kind?: 'api_key' }
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

/**
 * Stands in for ApiKeysService, which the guard consults only for tokens
 * carrying the machine-credential prefix. `authenticate` is the whole surface
 * the guard touches.
 */
const fakeApiKeys = (
  result: { orgId: string; keyId: string; role: 'viewer' | 'publisher' } | null = null,
) => ({ authenticate: async () => result }) as unknown as ApiKeysService

function makeGuard(isPublic = false, apiKeys = fakeApiKeys()): JwtGuard {
  return new JwtGuard(
    new TokenService(new JwtService({ secret: SECRET })),
    fakeReflector(isPublic),
    apiKeys,
  )
}

describe('JwtGuard', () => {
  it('populates request.auth from a valid bearer access token', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens, fakeReflector(), fakeApiKeys())
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
    const guard = new JwtGuard(tokens, fakeReflector(), fakeApiKeys())
    const pair = await tokens.issue(claims)
    const { context } = makeContext({ authorization: `Bearer ${pair.refreshToken}` })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepts a lowercase "bearer" scheme (RFC 7235 case-insensitivity)', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens, fakeReflector(), fakeApiKeys())
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

describe('JwtGuard and machine credentials', () => {
  const key = { orgId: 'org-1', keyId: 'key-1', role: 'publisher' as const }

  it('authenticates an API key presented as a bearer token', async () => {
    // Same header a person uses, distinguished by prefix — so every existing
    // client, proxy and CORS allowlist keeps working unchanged.
    const guard = makeGuard(false, fakeApiKeys(key))
    const { context, request } = makeContext({ authorization: 'Bearer maya_ci_abc.def' })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth).toMatchObject({ sub: 'key-1', orgId: 'org-1', role: 'publisher' })
  })

  it('marks it as a machine, so RolesGuard skips the membership re-read', async () => {
    // A key's subject is a key id: there is no membership row to find, and
    // without this marker every CI request would 403.
    const guard = makeGuard(false, fakeApiKeys(key))
    const { context, request } = makeContext({ authorization: 'Bearer maya_ci_abc.def' })

    await guard.canActivate(context)
    expect(request.auth?.kind).toBe('api_key')
  })

  it('refuses a key the service does not recognise', async () => {
    const guard = makeGuard(false, fakeApiKeys(null))
    const { context } = makeContext({ authorization: 'Bearer maya_ci_revoked.xxx' })

    await expect(guard.canActivate(context)).rejects.toThrow(/Invalid API key/i)
  })

  it('does not send a normal JWT down the API-key path', async () => {
    // The prefix is the only discriminator, so a token that lacks it must
    // still be verified as a JWT rather than silently rejected.
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = makeGuard(false, fakeApiKeys(null))
    const pair = await tokens.issue(claims)
    const { context, request } = makeContext({ authorization: `Bearer ${pair.accessToken}` })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth?.kind).toBeUndefined()
  })
})
