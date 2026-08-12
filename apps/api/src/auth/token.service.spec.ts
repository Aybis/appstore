import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { TokenService } from './token.service'

const SECRET = 'a'.repeat(32)

function makeService(): TokenService {
  return new TokenService(new JwtService({ secret: SECRET }))
}

const claims = {
  sub: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'publisher' as const,
}

describe('TokenService', () => {
  it('issues an access token carrying the org id and role', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    const decoded = await service.verifyAccess(pair.accessToken)
    expect(decoded).toMatchObject(claims)
  })

  it('issues a refresh token distinct from the access token', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    expect(pair.refreshToken).not.toBe(pair.accessToken)
  })

  it('refuses an access token that is actually a refresh token', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    await expect(service.verifyAccess(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuses a token signed with a different secret', async () => {
    const other = new TokenService(new JwtService({ secret: 'b'.repeat(32) }))
    const pair = await other.issue(claims)
    await expect(makeService().verifyAccess(pair.accessToken)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuses a structurally invalid token', async () => {
    await expect(makeService().verifyAccess('garbage')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
