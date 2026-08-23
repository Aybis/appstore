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
   * Paths to a TLS certificate and key, to serve HTTPS from this process.
   *
   * Both or neither. Two shapes are supported on purpose: a public deployment
   * usually terminates TLS at a proxy and leaves these unset (see TRUST_PROXY),
   * while a store hosted on a company LAN has no public DNS for an ACME
   * challenge and is far simpler with one process serving TLS directly than
   * with a second component to keep running.
   */
  TLS_CERT: z.string().default(''),
  TLS_KEY: z.string().default(''),

  /**
   * How many reverse proxies sit in front of this API, or which to trust.
   *
   * Matters the moment TLS is terminated somewhere else, which is the ordinary
   * production shape (security review S-6). Express only fills `req.ips` and
   * corrects `req.protocol` when it is told to trust the forwarding headers,
   * and until then two things are quietly wrong behind a proxy: every request
   * appears to come from the proxy's address — so the per-IP rate limit
   * becomes ONE GLOBAL BUDGET and a single noisy client locks out the company
   * — and `req.protocol` reads `http`, which puts an http:// URL inside the
   * iOS install manifest that iOS then refuses.
   *
   * Off by default, and that default is the safe one: trusting
   * X-Forwarded-For when nothing sets it lets any caller spoof their address,
   * evade the rate limit and poison the audit trail. Turn it on only when a
   * proxy really is in front.
   *
   * Accepts a hop count (`1`), an Express preset (`loopback`, `uniquelocal`),
   * or a comma-separated list of trusted addresses/CIDRs.
   */
  TRUST_PROXY: z.string().default(''),

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

/**
 * Turns TRUST_PROXY into the value Express expects.
 *
 * Exported and pure so the parsing is testable: getting this wrong is silent
 * in both directions — too permissive lets callers spoof their address, too
 * strict collapses every client into one rate-limit bucket — and neither
 * failure announces itself.
 */
export const trustProxySetting = (raw: string): boolean | number | string[] => {
  const value = raw.trim()
  if (!value || value.toLowerCase() === 'false') return false
  if (value.toLowerCase() === 'true') return true

  // A bare number is a hop count: trust exactly N proxies and take the address
  // N entries from the right, which cannot be spoofed by adding more entries.
  if (/^\d+$/.test(value)) return Number(value)

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
