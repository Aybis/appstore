export type Platform = 'android' | 'ios'
export type ReleaseTrack = 'internal' | 'beta' | 'production'
export type MembershipRole = 'owner' | 'admin' | 'publisher' | 'viewer'

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
  platform: Platform
  publisher: string
  packageId: string
  updatedAt: string
  accessStatus: 'available' | 'restricted' | 'unsupported'
}

export interface AuthResponse {
  accessToken: string
  /**
   * Absent in cookie mode, which is what the console uses — the server keeps
   * the refresh token in an httpOnly cookie and strips it from the body. Only
   * the mobile app, which does not send X-Auth-Mode, ever receives one.
   */
  refreshToken?: string
  expiresIn: number
  user?: { id: string; email: string; displayName: string; role: string }
}

export interface Tester {
  userId: string
  email: string
  displayName: string
  track: ReleaseTrack
  createdAt: string
}

export interface AuditEvent {
  id: string
  actorId: string | null
  action: string
  subjectType: string
  subjectId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface PublishedRelease {
  id: string
  version: string
  platform: Platform
  status: string
  track: ReleaseTrack
  sha256: string
  sizeBytes: number
  deduplicated: boolean
}

export interface ReleaseSummary {
  id: string
  version: string
  platform: Platform
  status: string
  track: ReleaseTrack
  releaseNotes: string
  sha256: string | null
  sizeBytes: number
  publishedAt: string | null
  createdAt: string
}


/**
 * An app as the CMS sees it, which is not what a device sees.
 *
 * The catalog endpoints apply the mobile app's visibility rules — an app is
 * listed only once it has a published release on a visible track. Right for a
 * device, wrong for a console: an app registered a minute ago would not exist.
 */
export interface ManagedApp {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  category: string
  publisher: string
  platform: string
  packageId: string
  /** Path, not an absolute URL — prefix with the API origin to render it. */
  iconUrl: string
  featured: boolean
  releaseCount: number
  publishedCount: number
  latestVersion: string
  updatedAt: string
}
