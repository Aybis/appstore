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
  refreshToken: string
  expiresIn: number
  user?: { id: string; email: string; name: string }
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
