import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { CatalogService, type CatalogPlatform } from './catalog.service'

export interface VersionCheckResult {
  packageId: string
  platform: CatalogPlatform
  /** What the caller reported running. */
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  /** True when the running build is below the app's minimum_version floor. */
  updateRequired: boolean
  releaseNotes: string
  publishedAt: string | null
  /** Deep link that opens this app's page in the store client. */
  storeUrl: string
}

const platformOf = (value?: string): CatalogPlatform | null =>
  value === 'android' || value === 'ios' ? value : null

/**
 * The endpoint distributed apps call on launch to find out whether they are
 * current — the other half of a store that installs rather than merely lists.
 *
 * `@Public()` on purpose, and the shape is chosen to make that safe:
 *
 *   - the caller is a DIFFERENT app (HR Portal, not the store), so it holds no
 *     user session and cannot carry a bearer token;
 *   - it must already know its own org slug and package id to ask anything, so
 *     this enumerates nothing — there is no "list the catalog" here;
 *   - the response carries version metadata and a deep link only. Binaries stay
 *     behind the authenticated download ticket, so a public answer never leaks
 *     an artifact.
 *
 * If that trade is ever unacceptable, the fix is a per-org API key header, not
 * a user JWT — the calling app still has no user.
 */
@Controller('version-check')
export class VersionCheckController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get()
  async check(
    @Query('org') orgSlug?: string,
    @Query('packageId') packageId?: string,
    @Query('platform') platform?: string,
    @Query('version') version?: string,
  ): Promise<VersionCheckResult> {
    const resolved = platformOf(platform)

    if (!orgSlug || !packageId || !resolved || !version) {
      throw new BadRequestException(
        'org, packageId, platform (android|ios) and version are all required',
      )
    }

    const result = await this.catalog.versionCheck(
      orgSlug,
      packageId,
      resolved,
      version,
    )
    if (!result) {
      throw new NotFoundException(
        `No published ${resolved} release for package "${packageId}"`,
      )
    }
    return result
  }
}
