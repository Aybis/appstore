/**
 * Console configuration.
 *
 * Read from Vite env vars so one build can point at dev, staging or production
 * without a code change. Defaults target the local API, which is what a fresh
 * clone needs to run.
 */

const env = import.meta.env

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000',
  apiPrefix: '/v1',
  /** The organization this console is deployed for. */
  orgSlug: (env.VITE_ORG_SLUG as string | undefined) ?? 'maya',
  /** Where the marketing site lives; used for store and deep links. */
  siteUrl: (env.VITE_SITE_URL as string | undefined) ?? 'https://muchtar.dev',
} as const
