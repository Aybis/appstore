import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'
import { DownloadSigner } from './download-signer'
import { compareVersions } from './version'
import type { VersionCheckResult } from './version-check.controller'

export type CatalogPlatform = 'android' | 'ios'

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
  updatedAt: new Date(row.published_at ?? row.updated_at).toISOString(),
  accessStatus: 'available',
})

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly signer: DownloadSigner,
  ) {}

  /**
   * One row per app, joined to its current release.
   *
   * An app may ship on both platforms with different version strings, but the
   * client's model carries a single version — so the lateral picks the most
   * recently published release, narrowed to `platform` when the caller knows
   * which device is asking.
   */
  private async rows(orgId: string, options: ListOptions): Promise<CatalogRow[]> {
    const { category = null, featuredOnly = false, sort = 'name', platform = null, query = null } = options

    return withTenant(this.db, orgId, async (tx) => {
      const result = await tx.execute<CatalogRow>(sql`
        SELECT a.id, a.slug, a.name, a.category, a.tagline, a.description,
               a.publisher, a.featured, a.rating, a.rating_count,
               a.screenshot_urls, a.updated_at,
               r.platform, r.version, r.min_os, r.release_notes, r.published_at,
               f.id AS artifact_id, f.size_bytes, f.sha256
        FROM apps a
        JOIN LATERAL (
          SELECT * FROM releases rel
          WHERE rel.app_id = a.id
            AND rel.status = 'published'
            AND (${platform}::text IS NULL OR rel.platform::text = ${platform}::text)
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

  async list(orgId: string, options: ListOptions = {}): Promise<CatalogApp[]> {
    return (await this.rows(orgId, options)).map(toApp)
  }

  async detail(orgId: string, slug: string, platform?: CatalogPlatform | null): Promise<CatalogApp> {
    const found = (await this.rows(orgId, { platform: platform ?? null })).find(
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
    slug: string,
    baseUrl: string,
    platform?: CatalogPlatform | null,
  ): Promise<DownloadTicket> {
    const row = (await this.rows(orgId, { platform: platform ?? null })).find(
      (candidate) => candidate.slug === slug,
    )
    if (!row) throw new NotFoundException(`No app with slug "${slug}"`)

    const { expiresAt, signature } = this.signer.issue(row.artifact_id, orgId)
    const url =
      `${baseUrl}/download/${row.artifact_id}/stream` +
      `?org=${encodeURIComponent(orgId)}&exp=${expiresAt}&sig=${signature}`

    return {
      appId: row.id,
      version: row.version,
      url,
      sizeBytes: Number(row.size_bytes),
      checksum: row.sha256,
      platform: row.platform,
      ...(row.platform === 'ios'
        ? {
            instructions:
              `${row.name} ${row.version} is distributed as an IPA. iOS cannot install ` +
              'it from a plain link — it needs an itms-services manifest signed with ' +
              "your organisation's Apple distribution certificate, which lands with " +
              'the distribution adapter.',
          }
        : {}),
    }
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
        ORDER BY r.published_at DESC NULLS LAST, r.created_at DESC
        LIMIT 1
      `)

      const row = [...rows][0]
      if (!row) return null

      const floor = row.minimum_version?.trim()

      return {
        packageId,
        platform,
        currentVersion,
        latestVersion: row.version,
        updateAvailable: compareVersions(currentVersion, row.version) < 0,
        // An empty floor means "never force" — the safe default for every row
        // that has not opted in.
        updateRequired: Boolean(floor) && compareVersions(currentVersion, floor!) < 0,
        releaseNotes: row.release_notes,
        publishedAt: row.published_at
          ? new Date(row.published_at).toISOString()
          : null,
        storeUrl: `maya://app/${row.slug}`,
      }
    })
  }
}
