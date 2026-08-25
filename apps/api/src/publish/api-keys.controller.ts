import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common'
import { ZodValidationPipe } from 'nestjs-zod'
import { z } from 'zod'

import { Roles } from '../auth/roles.decorator'
import { ApiKeysService, type ApiKeySummary, type MintedApiKey } from '../auth/api-keys.service'
import type { ApiKeyRole } from '../db/api-keys.schema'

interface AuthedRequest {
  auth?: { sub: string; orgId: string }
}

const mintSchema = z.object({
  name: z.string().min(1).max(80),
  /*
   * Only the two the database will accept. The CHECK constraint is the real
   * boundary (S-8) — this schema exists so a mistake reads as a 400 rather
   * than a 500 from a rejected INSERT, not because it is what enforces the cap.
   */
  role: z.enum(['viewer', 'publisher']).default('publisher'),
  /** A year is the ceiling. A credential nobody rotates is one nobody owns. */
  expiresInDays: z.number().int().min(1).max(365).default(90),
})

/**
 * Machine credentials, managed by people.
 *
 * `@Roles('admin', 'owner')` — publisher can USE a key but not mint one.
 * Otherwise a leaked publisher key could mint itself a successor and outlive
 * its own revocation, which defeats the point of being able to revoke it.
 */
@Controller('api-keys')
@Roles('admin', 'owner')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  private identity(req: AuthedRequest): { orgId: string; userId: string } {
    const auth = req.auth
    if (!auth) throw new Error('ApiKeysController reached without authentication')
    return { orgId: auth.orgId, userId: auth.sub }
  }

  @Get()
  list(@Req() req: AuthedRequest): Promise<ApiKeySummary[]> {
    return this.keys.list(this.identity(req).orgId)
  }

  /** The only response that ever contains the secret. */
  @Post()
  mint(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(mintSchema))
    body: { name: string; role: ApiKeyRole; expiresInDays: number },
  ): Promise<MintedApiKey> {
    const { orgId, userId } = this.identity(req)
    return this.keys.mint(orgId, userId, body.name, body.role, body.expiresInDays)
  }

  @Delete(':id')
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    const { orgId, userId } = this.identity(req)
    await this.keys.revoke(orgId, userId, id)
  }
}
