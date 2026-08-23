import { Controller, Get, Param, Query, Req } from '@nestjs/common'
import type { MembershipRole } from '../auth/token.service'
import {
  CatalogService,
  type CatalogApp,
  type CatalogPlatform,
  type DownloadTicket,
  type Viewer,
} from './catalog.service'

/**
 * Structural, not `express.Request` — this package intentionally carries no
 * `@types/express` (see the same pattern in auth/jwt.guard.ts), so handlers
 * declare exactly the surface they touch.
 */
interface AuthedRequest {
  // `role` is the membership row RolesGuard re-read for this request, not the
  // token's possibly-stale claim.
  auth?: { sub: string; orgId: string; role: MembershipRole }
  protocol: string
  get(header: string): string | undefined
}

const platformOf = (value?: string): CatalogPlatform | null =>
  value === 'android' || value === 'ios' ? value : null

const sortOf = (value?: string): 'name' | 'recent' | 'rating' =>
  value === 'recent' || value === 'rating' ? value : 'name'

/**
 * Catalog reads for the mobile client. Every route is org-scoped from the
 * verified token — the org is never taken from a query parameter, so a client
 * cannot ask for another tenant's catalog.
 *
 * No `@Public()` here on purpose: the global guards deny by default, and an
 * org's app list is tenant data.
 */
@Controller('apps')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  private orgId(req: AuthedRequest): string {
    const orgId = req.auth?.orgId
    if (!orgId) throw new Error('CatalogController reached without an authenticated org')
    return orgId
  }

  /** Identity plus current role — release-track visibility depends on both. */
  private viewer(req: AuthedRequest): Viewer {
    const auth = req.auth
    if (!auth) throw new Error('CatalogController reached without authentication')
    return { userId: auth.sub, role: auth.role }
  }

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('sort') sort?: string,
    @Query('platform') platform?: string,
  ): Promise<CatalogApp[]> {
    return this.catalog.list(this.orgId(req), this.viewer(req), {
      category: category ?? null,
      featuredOnly: featured === 'true',
      sort: sortOf(sort),
      platform: platformOf(platform),
    })
  }

  // Declared before ':slug' — Nest matches in declaration order, so the
  // parameterised route would otherwise swallow "search".
  @Get('search')
  search(
    @Req() req: AuthedRequest,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('platform') platform?: string,
  ): Promise<CatalogApp[]> {
    return this.catalog.list(this.orgId(req), this.viewer(req), {
      query: q?.trim() ? q.trim() : null,
      category: category ?? null,
      platform: platformOf(platform),
    })
  }

  @Get(':slug')
  detail(
    @Req() req: AuthedRequest,
    @Param('slug') slug: string,
    @Query('platform') platform?: string,
  ): Promise<CatalogApp> {
    return this.catalog.detail(this.orgId(req), this.viewer(req), slug, platformOf(platform))
  }

  @Get(':slug/download')
  download(
    @Req() req: AuthedRequest,
    @Param('slug') slug: string,
    @Query('platform') platform?: string,
  ): Promise<DownloadTicket> {
    // The ticket URL must be absolute: it is handed to the platform downloader,
    // which has no notion of this request's origin.
    const base = `${req.protocol}://${req.get('host') ?? 'localhost'}`
    return this.catalog.ticket(this.orgId(req), this.viewer(req), slug, base, platformOf(platform))
  }
}
