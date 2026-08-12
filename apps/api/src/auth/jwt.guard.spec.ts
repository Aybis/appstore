import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, it } from 'vitest'
import { JwtGuard } from './jwt.guard'
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

function makeContext(headers: FakeRequest['headers']): { context: ExecutionContext; request: FakeRequest } {
  const request: FakeRequest = { headers }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { context, request }
}

function makeGuard(): JwtGuard {
  return new JwtGuard(new TokenService(new JwtService({ secret: SECRET })))
}

describe('JwtGuard', () => {
  it('populates request.auth from a valid bearer access token', async () => {
    const tokens = new TokenService(new JwtService({ secret: SECRET }))
    const guard = new JwtGuard(tokens)
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
    const guard = new JwtGuard(tokens)
    const pair = await tokens.issue(claims)
    const { context } = makeContext({ authorization: `Bearer ${pair.refreshToken}` })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
