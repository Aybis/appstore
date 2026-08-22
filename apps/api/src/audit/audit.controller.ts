import { Controller, Get, Query, Req } from '@nestjs/common'
import { Roles } from '../auth/roles.decorator'
import { AuditService, type AuditRecord } from './audit.service'

/** Structural, matching this package's no-@types/express convention. */
interface AuthedRequest {
  auth?: { sub: string; orgId: string }
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/**
 * Reads the org's audit trail.
 *
 * `@Roles('admin')` — RolesGuard lets an owner through any role list, so this
 * is admins and owners. A publisher can create the events but must not be able
 * to review who else did what, and a viewer has no business here at all.
 *
 * No `@Public()`: the global guards deny by default, and the trail is tenant
 * data. The org comes from the verified token, never from a query parameter.
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('admin')
  list(@Req() req: AuthedRequest, @Query('limit') limit?: string): Promise<AuditRecord[]> {
    const orgId = req.auth?.orgId
    if (!orgId) throw new Error('AuditController reached without an authenticated org')

    // Clamped rather than validated: a caller asking for 10,000 events gets
    // 500, not a 400. The cap exists to bound the response, and an audit
    // reader hitting it should page, not fail.
    const requested = Number.parseInt(limit ?? '', 10)
    const bounded = Math.min(Math.max(Number.isNaN(requested) ? DEFAULT_LIMIT : requested, 1), MAX_LIMIT)

    return this.audit.list(orgId, bounded)
  }
}
