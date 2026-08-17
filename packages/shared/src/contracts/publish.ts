import { z } from 'zod'
import { appSlugSchema } from '../identifiers.js'

export const appPlatformSchema = z.enum(['android', 'ios', 'both'])
export const releasePlatformSchema = z.enum(['android', 'ios'])

export const createAppSchema = z.object({
  slug: appSlugSchema,
  name: z.string().min(1).max(120),
  platform: appPlatformSchema,
  description: z.string().max(4000).default(''),
  tagline: z.string().max(200).default(''),
  category: z.string().max(60).default('uncategorized'),
  publisher: z.string().max(120).default(''),
  featured: z.coerce.boolean().default(false),
  /**
   * Oldest build still allowed to run; empty means never force. Deliberately
   * not semver-validated — real store versions are not semver ("9.2 (941607204)").
   */
  minimumVersion: z.string().max(60).default(''),
})

export type CreateAppInput = z.infer<typeof createAppSchema>

/**
 * Fields accompanying an uploaded binary. Everything arrives as a multipart
 * text field, hence the coercions — a form sends "true", not true.
 *
 * `sha256` and `sizeBytes` are NOT accepted from the client: the server
 * computes both from the bytes it received, so a caller cannot register one
 * binary under another's digest.
 */
export const createReleaseSchema = z.object({
  version: z.string().min(1).max(120),
  platform: releasePlatformSchema,
  packageId: z.string().min(1).max(200),
  minOs: z.string().max(60).default(''),
  releaseNotes: z.string().max(8000).default(''),
  /** Publish immediately instead of leaving the release in draft. */
  publish: z.coerce.boolean().default(false),
})

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>
