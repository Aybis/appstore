import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import type { MembershipRole } from '../auth/token.service'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'
import { DownloadSigner } from './download-signer'
import { DistributionRegistry } from '../distribution/distribution.registry'
import { ItmsServicesAdapter } from '../distribution/itms-services.adapter'
import type { DistributionSubject } from '../distribution/distribution.port'
import { compareVersions, updateSeverity } from './version'
import type { VersionCheckResult } from './version-check.controller'

export type CatalogPlatform = 'android' | 'ios'

export type ReleaseTrack = 'internal' | 'beta' | 'production'

/**
 * Who is asking. Release-track visibility depends on it, so every catalog read
 * carries it rather than defaulting to "everyone sees everything".
 */
export interface Viewer {
  userId: string
  role: MembershipRole
}

/**
 * Publishers and above see every track. They are the people who upload builds
 * and smoke-test them, so gating them behind a tester enrolment would mean
 * enrolling every publisher in every app for the feature to work at all.
 */
export const seesEveryTrack = (role: MembershipRole): boolean =>
  role === 'publisher' || role === 'admin' || role === 'owner'

/** The wire shape the mobile client's `App` type expects. */
export interface CatalogApp {
  id: string
  slug: string
  name: string
  category: string
  version: string
  size: number
  screenshotUrls: string[]
  tagline: string
  description: string
  releaseNotes: string
  minOs: string
  rating: number
  ratingCount: number
  featured: boolean
  platform: CatalogPlatform
  publisher: string
  /**
   * Android package name / iOS bundle id. Exposed so a client can ask the OS
   * whether this app is actually installed, rather than trusting its own log.
   */
  packageId: string
  /**
   * Public, digest-addressed URL for the app's icon, or '' when it has none.
   *
   * A path rather than an absolute URL: the client already knows the API
   * origin it dialled, and baking one in here would hand a device on the LAN a
   * URL built from whatever hostname the request happened to arrive on.
   */
  iconUrl: string
  /**
   * Which stage this build came from.
   *
   * Exposed so a tester can SEE that what they are holding is not what
   * everybody else has. Without it a beta build is indistinguishable from a
   * release on the device, which makes "it is broken" and "it is broken and
   * that is expected, you are testing it" the same sentence.
   *
   * Not a permission: visibility is already decided server-side by the LATERAL
   * join below. This only names what was chosen.
   */
  track: string
  updatedAt: string
  accessStatus: 'available' | 'restricted' | 'unsupported'
}

export interface DownloadTicket {
  appId: string
  version: string
  url: string
  sizeBytes: number
  checksum: string
  platform: CatalogPlatform
  instructions?: string
}

interface CatalogRow extends Record<string, unknown> {
  id: string
  slug: string
  name: string
  category: string
  tagline: string
  description: string
  publisher: string
  featured: boolean
  rating: number
  rating_count: number
  screenshot_urls: string[]
  platform: CatalogPlatform
  version: string
  min_os: string
  release_notes: string
  published_at: string | null
  updated_at: string
  size_bytes: string | number
  artifact_id: string
  sha256: string
  package_id: string
  icon_key: string
  app_package_id: string
  track: string
}

export interface ListOptions {
  category?: string | null
  featuredOnly?: boolean
  sort?: 'name' | 'recent' | 'rating'
  platform?: CatalogPlatform | null
  query?: string | null
}

const toApp = (row: CatalogRow): CatalogApp => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category,
  version: row.version,
  size: Number(row.size_bytes),
  screenshotUrls: row.screenshot_urls ?? [],
  tagline: row.tagline,
  description: row.description,
  releaseNotes: row.release_notes,
  minOs: row.min_os,
  rating: row.rating,
  ratingCount: row.rating_count,
  featured: row.featured,
  platform: row.platform,
  publisher: row.publisher,
  /*
   * The app's own package id wins over the artifact's. The artifact records
   * what was inside a particular binary; the app records what it is. They
   * agree by construction now — publishing refuses a mismatch — but an app
   * with no release yet has an app-level id and no artifact at all, and that
   * is precisely when install detection needs one.
   */
  packageId: row.app_package_id || row.package_id,
  track: row.track,
  iconUrl: row.icon_key ? `/v1/icons/${row.icon_key}` : '',
  updatedAt: new Date(row.published_at ?? row.updated_at).toISOString(),
  accessStatus: 'available',
})

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly signer: DownloadSigner,
    private readonly distribution: DistributionRegistry,
    private readonly itms: ItmsServicesAdapter,
    private readonly audit: AuditService,
  ) {}

  /** Signs a capability URL for one artifact. */
  private signedUrl(baseUrl: string, path: string, artifactId: string, orgId: string): string {
    const { expiresAt, signature } = this.signer.issue(artifactId, orgId)
    return (
      `${baseUrl}/download/${artifactId}/${path}` +
      `?org=${encodeURIComponent(orgId)}&exp=${expiresAt}&sig=${signature}`
    )
  }

  /**
   * One row per app, joined to its current release.
   *
   * An app may ship on both platforms with different version strings, but the
   * client's model carries a single version — so the lateral picks the most
   * recently published release, narrowed to `platform` when the caller knows
   * which device is asking.
   */
  private async rows(
    orgId: string,
    viewer: Viewer,
    options: ListOptions,
  ): Promise<CatalogRow[]> {
    const { category = null, featuredOnly = false, sort = 'name', platform = null, query = null } = options
    const staff = seesEveryTrack(viewer.role)

    return withTenant(this.db, orgId, async (tx) => {
      const result = await tx.execute<CatalogRow>(sql`
        SELECT a.id, a.slug, a.name, a.category, a.tagline, a.description,
               a.publisher, a.featured, a.rating, a.rating_count,
               a.screenshot_urls, a.updated_at, a.icon_key, a.package_id AS app_package_id,
               r.platform, r.version, r.min_os, r.release_notes, r.published_at, r.track,
               f.id AS artifact_id, f.size_bytes, f.sha256, f.package_id
        FROM apps a
        JOIN LATERAL (
          SELECT * FROM releases rel
          WHERE rel.app_id = a.id
            AND rel.status = 'published'
            AND (${platform}::text IS NULL OR rel.platform::text = ${platform}::text)
            -- Track visibility. Ordinary members see production only, so an
            -- internal or beta build is invisible to them and — because the
            -- client derives "a new version exists" from this very row — also
            -- announces nothing to them.
            --
            -- Testers compare by RANK, not equality: a tester enrolled at
            -- 'beta' must still see production builds, or promoting a release
            -- would make it vanish for the people who tested it.
            AND (
              rel.track = 'production'
              OR ${staff}::boolean
              OR EXISTS (
                SELECT 1 FROM app_testers t
                WHERE t.app_id = a.id
                  AND t.user_id = ${viewer.userId}::uuid
                  AND array_position(ARRAY['internal','beta','production']::text[], rel.track::text)
                      >= array_position(ARRAY['internal','beta','production']::text[], t.track::text)
              )
            )
          ORDER BY rel.published_at DESC NULLS LAST, rel.created_at DESC
          LIMIT 1
        ) r ON TRUE
        JOIN LATERAL (
          SELECT * FROM artifacts art
          WHERE art.release_id = r.id
          ORDER BY art.created_at DESC
          LIMIT 1
        ) f ON TRUE
        WHERE (${category}::text IS NULL OR a.category = ${category}::text)
          AND (${featuredOnly}::boolean IS FALSE OR a.featured IS TRUE)
          AND (
            ${query}::text IS NULL
            OR a.name ILIKE '%' || ${query}::text || '%'
            OR a.description ILIKE '%' || ${query}::text || '%'
            OR a.tagline ILIKE '%' || ${query}::text || '%'
            OR a.publisher ILIKE '%' || ${query}::text || '%'
          )
        ORDER BY
          CASE WHEN ${sort}::text = 'name' THEN a.name END ASC,
          CASE WHEN ${sort}::text = 'recent' THEN r.published_at END DESC,
          CASE WHEN ${sort}::text = 'rating' THEN a.rating END DESC,
          a.name ASC
      `)
      return [...result]
    })
  }

  async list(orgId: string, viewer: Viewer, options: ListOptions = {}): Promise<CatalogApp[]> {
    return (await this.rows(orgId, viewer, options)).map(toApp)
  }

  async detail(
    orgId: string,
    viewer: Viewer,
    slug: string,
    platform?: CatalogPlatform | null,
  ): Promise<CatalogApp> {
    const found = (await this.rows(orgId, viewer, { platform: platform ?? null })).find(
      (row) => row.slug === slug,
    )
    if (!found) throw new NotFoundException(`No app with slug "${slug}"`)
    return toApp(found)
  }

  /**
   * iOS gets instructions rather than a stream: an `itms-services` install
   * needs a manifest signed with the tenant's own Apple credentials, which is
   * the DistributionPort work in the rest of Plan 02. Android gets a signed,
   * expiring URL the system downloader can fetch on its own.
   */
  async ticket(
    orgId: string,
    viewer: Viewer,
    slug: string,
    baseUrl: string,
    platform?: CatalogPlatform | null,
  ): Promise<DownloadTicket> {
    // Resolved through the same track-aware query as the catalog, deliberately:
    // if a build is not visible to this viewer, they must not be able to obtain
    // a download ticket for it by guessing the slug.
    const row = (await this.rows(orgId, viewer, { platform: platform ?? null })).find(
      (candidate) => candidate.slug === slug,
    )
    if (!row) throw new NotFoundException(`No app with slug "${slug}"`)

    const artifactUrl = this.signedUrl(baseUrl, 'stream', row.artifact_id, orgId)
    const manifestUrl = this.signedUrl(baseUrl, 'manifest.plist', row.artifact_id, orgId)

    const subject: DistributionSubject = {
      appName: row.name,
      slug: row.slug,
      version: row.version,
      packageId: '',
      sizeBytes: Number(row.size_bytes),
      sha256: row.sha256,
      artifactUrl,
      manifestUrl,
    }

    // The platform rule lives in the adapter, not here: Android streams bytes,
    // iOS can only act on an itms-services link.
    const descriptor = this.distribution.for(row.platform).describe(subject, baseUrl)

    // Issuance, not completion — this is the moment the org hands out a signed
    // capability to a binary, which is the auditable act. Whether the device
    // finished the transfer is install telemetry and belongs to the client.
    // The subject is the artifact, not the app: `row.id` here is the app id
    // (see `appId: row.id` below), and the auditable object is the specific
    // binary a signed URL was just minted for. App and version travel in the
    // metadata so the trail reads without a join.
    await this.audit.record(orgId, {
      actorId: viewer.userId,
      action: 'artifact.download_issued',
      subjectType: 'artifact',
      subjectId: row.artifact_id,
      metadata: {
        app: row.slug,
        appId: row.id,
        version: row.version,
        platform: row.platform,
        sha256: row.sha256,
      },
    })

    return {
      appId: row.id,
      version: row.version,
      url: descriptor.url,
      sizeBytes: Number(row.size_bytes),
      checksum: row.sha256,
      platform: row.platform,
      ...(descriptor.instructions ? { instructions: descriptor.instructions } : {}),
    }
  }

  /**
   * Builds the itms-services manifest for one artifact. The IPA URL inside it
   * is signed separately, because iOS fetches it as a second request.
   */
  async manifestFor(orgId: string, artifactId: string, baseUrl: string): Promise<string> {
    return withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{
        name: string
        slug: string
        version: string
        package_id: string
        sha256: string
        size_bytes: string | number
      }>(sql`
        SELECT a.name, a.slug, r.version, f.package_id, f.sha256, f.size_bytes
        FROM artifacts f
        JOIN releases r ON r.id = f.release_id
        JOIN apps a ON a.id = r.app_id
        WHERE f.id = ${artifactId}::uuid
      `)
      const row = [...rows][0]
      if (!row) throw new NotFoundException('Artifact not found')

      return this.itms.manifest({
        appName: row.name,
        slug: row.slug,
        version: row.version,
        packageId: row.package_id,
        sizeBytes: Number(row.size_bytes),
        sha256: row.sha256,
        artifactUrl: this.signedUrl(baseUrl, 'stream', artifactId, orgId),
      })
    })
  }

  async artifactForStream(
    orgId: string,
    artifactId: string,
  ): Promise<{ storageKey: string; contentType: string; filename: string; sizeBytes: number }> {
    return withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{
        storage_key: string
        content_type: string
        original_filename: string
        size_bytes: string | number
      }>(sql`
        SELECT storage_key, content_type, original_filename, size_bytes
        FROM artifacts WHERE id = ${artifactId}::uuid
      `)
      const row = [...rows][0]
      if (!row) throw new NotFoundException('Artifact not found')
      return {
        storageKey: row.storage_key,
        contentType: row.content_type,
        filename: row.original_filename,
        sizeBytes: Number(row.size_bytes),
      }
    })
  }

  /**
   * Answers "am I current?" for a distributed app.
   *
   * Resolves the org by slug outside withTenant — `organizations` carries no
   * org_id and no RLS policy, and the tenant GUC cannot be set until the org id
   * is known. Everything after that is inside the tenant transaction.
   */
  async versionCheck(
    orgSlug: string,
    packageId: string,
    platform: CatalogPlatform,
    currentVersion: string,
  ): Promise<VersionCheckResult | null> {
    const orgs = await this.db.execute<{ id: string }>(sql`
      SELECT id FROM organizations WHERE slug = ${orgSlug}
    `)
    const org = [...orgs][0]
    if (!org) return null

    return withTenant(this.db, org.id, async (tx) => {
      const rows = await tx.execute<{
        slug: string
        minimum_version: string
        version: string
        release_notes: string
        published_at: string | null
      }>(sql`
        SELECT a.slug, a.minimum_version, r.version, r.release_notes, r.published_at
        FROM artifacts f
        JOIN releases r ON r.id = f.release_id
        JOIN apps a ON a.id = r.app_id
        WHERE f.package_id = ${packageId}
          AND r.platform::text = ${platform}
          AND r.status = 'published'
          -- Production ONLY, and this is the load-bearing line of the whole
          -- track feature. This endpoint is public: it is called by the
          -- distributed app itself, which carries no user session, so there is
          -- nobody here to be a tester. Letting it see an internal or beta
          -- build would announce every unreleased version to every install —
          -- exactly what uploading to a private track is meant to prevent.
          AND r.track = 'production'
        ORDER BY r.published_at DESC NULLS LAST, r.created_at DESC
        LIMIT 1
      `)

      const row = [...rows][0]
      if (!row) return null

      const floor = row.minimum_version?.trim()
      const severity = updateSeverity(currentVersion, row.version)

      return {
        packageId,
        platform,
        currentVersion,
        latestVersion: row.version,
        updateAvailable: severity !== 'none',
        severity,
        // Two independent reasons to force an update, and both are kept:
        //
        //   - the organization's rule, where a change in the first or second
        //     digit is major and cannot be dismissed;
        //   - `minimum_version`, an explicit floor a publisher sets by hand.
        //
        // The floor survives because it is the only way to force an update for
        // a build the rule would call minor — a security patch shipped as
        // 1.0.0 -> 1.0.1 is exactly that case.
        updateRequired:
          severity === 'major' ||
          (Boolean(floor) && compareVersions(currentVersion, floor!) < 0),
        releaseNotes: row.release_notes,
        publishedAt: row.published_at
          ? new Date(row.published_at).toISOString()
          : null,
        storeUrl: `${process.env.DEEP_LINK_BASE ?? 'maya://app'}/${row.slug}`,
      }
    })
  }
}
