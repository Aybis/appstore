import { z } from 'zod'

/** Slugs that would collide with top-level API routes or reserved subdomains. */
const RESERVED_ORG_SLUGS = new Set([
  'api', 'admin', 'www', 'app', 'auth', 'billing', 'static', 'assets', 'health',
])

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const baseSlug = z
  .string()
  .min(3, 'must be at least 3 characters')
  .max(63, 'must be at most 63 characters')
  .regex(SLUG_PATTERN, 'must be lowercase alphanumeric with internal hyphens only')

/** Org slugs are globally unique and appear in URLs, so reserved names are excluded. */
export const orgSlugSchema = baseSlug.refine(
  (value) => !RESERVED_ORG_SLUGS.has(value),
  { message: 'this slug is reserved' },
)

/** App slugs are unique only within an org, so they need no reserved list. */
export const appSlugSchema = baseSlug

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/

export const semverSchema = z.string().regex(SEMVER_PATTERN, 'must be a valid semantic version')
