import { Controller, Get, Param, Req } from '@nestjs/common'

import { Roles } from '../auth/roles.decorator'
import { PublishService, type ManagedApp } from './publish.service'

interface AuthedRequest {
  auth?: { orgId: string }
}

/**
 * What the CMS sees, as distinct from what a device sees.
 *
 * A separate prefix rather than `/apps/manage`, because CatalogController also
 * owns `/apps` and its `@Get(':slug')` would match `manage` as a slug — route
 * resolution follows module registration order, so which one won would depend
 * on something no reader of either file could see.
 */
@Controller('manage/apps')
@Roles('publisher', 'admin', 'owner')
export class ManageController {
  constructor(private readonly publish: PublishService) {}

  private orgId(req: AuthedRequest): string {
    const orgId = req.auth?.orgId
    if (!orgId) throw new Error('ManageController reached without authentication')
    return orgId
  }

  @Get()
  list(@Req() req: AuthedRequest): Promise<ManagedApp[]> {
    return this.publish.listManaged(this.orgId(req))
  }

  @Get(':slug')
  detail(@Req() req: AuthedRequest, @Param('slug') slug: string): Promise<ManagedApp> {
    return this.publish.managedApp(this.orgId(req), slug)
  }
}
