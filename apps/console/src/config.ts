/**
 * Console configuration.
 *
 * Read from Vite env vars so one build can point at dev, staging or production
 * without a code change. Defaults target the local API, which is what a fresh
 * clone needs to run.
 */

const env = import.meta.env

/**
 * Same host as the page, port 3000.
 *
 * Hardcoding `http://localhost:3000` was wrong in the one case that matters
 * most: the portal exists to be opened on a phone, and `localhost` on a phone
 * is the phone. Every device that scanned the install QR would load the page
 * fine and then fail every API call against itself.
 *
 * Deriving it from the page's own origin is right by construction wherever the
 * console is served from — loopback, a LAN address, or a real domain — and
 * VITE_API_BASE_URL still overrides it for deployments where the API lives
 * somewhere else entirely.
 */
const sameHostApi = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  return `${window.location.protocol}//${window.location.hostname}:3000`
}

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? sameHostApi(),
  apiPrefix: '/v1',
  /** The organization this console is deployed for. */
  orgSlug: (env.VITE_ORG_SLUG as string | undefined) ?? 'maya',
  /** Where the marketing site lives; used for store and deep links. */
  siteUrl: (env.VITE_SITE_URL as string | undefined) ?? 'https://muchtar.dev',
} as const
