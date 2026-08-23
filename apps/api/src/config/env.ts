import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),

  /**
   * Origins allowed to call this API from a browser.
   *
   * Comma-separated, and there is deliberately no default and no wildcard: the
   * console cannot talk to the API until somebody names its origin, which is a
   * far better failure than a permissive `enableCors()` that reflects whatever
   * origin asks. Empty means "no browser client", which is the correct state
   * for an API only mobile apps call.
   */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  /**
   * Whether the refresh cookie carries the `Secure` attribute.
   *
   * A `Secure` cookie is simply discarded by the browser over plain HTTP, so
   * turning this on without TLS does not harden anything — it signs everybody
   * out. Defaults to on in production and off elsewhere, which is the right
   * way round: a development machine has no TLS, and a production deployment
   * that has none has a bigger problem than this flag (security review S-6).
   */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === undefined ? undefined : value === 'true'),

  /**
   * Where the download portal is served, as a device on the network sees it.
   *
   * This is what the install QR code encodes, which makes `localhost` an
   * actively wrong answer rather than merely a lazy one: the phone scanning
   * that code is never the machine serving the page, so a QR pointing at
   * localhost fails for every single person who scans it — and fails silently,
   * looking like a broken download rather than a bad URL.
   *
   * Left unset it falls back to the first CORS origin that is not loopback,
   * because that value is already the console's real origin and an operator
   * had to get it right for the console to load at all. Reusing a
   * proven-correct value beats introducing a second one to forget.
   */
  PORTAL_URL: z.string().default(''),

  /**
   * Where a deep link into the store points.
   *
   * Defaults to the custom scheme, which always works but only once the app is
   * installed. Set it to an https origin you control (and serve the App Links /
   * Universal Links association files from) so the same link opens the app when
   * present and the website when not.
   */
  DEEP_LINK_BASE: z.string().default('maya://app'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Fails fast at boot with every invalid variable named at once, rather than
 * surfacing a misconfiguration as a runtime error hours later.
 */
export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration — ${detail}`)
  }
  return result.data
}

export const ENV = Symbol('ENV')
