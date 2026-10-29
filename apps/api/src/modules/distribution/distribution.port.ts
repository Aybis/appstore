import type { CatalogPlatform } from '../catalog/catalog.service'

/** Everything an adapter needs to describe one installable build. */
export interface DistributionSubject {
  appName: string
  slug: string
  version: string
  /** Package name (Android) or bundle identifier (iOS). */
  packageId: string
  sizeBytes: number
  sha256: string
  /** Signed, expiring URL the device can fetch the binary from. */
  artifactUrl: string
  /**
   * Signed, expiring URL of the itms-services manifest. Built by the caller,
   * not the adapter, because only the caller can sign it.
   */
  manifestUrl?: string
}

export interface InstallDescriptor {
  /** What the client should open. */
  url: string
  /**
   * How the client should treat `url`:
   *   stream — fetch it directly and hand the file to the OS installer
   *   handoff — open it and let the OS take over from there
   */
  mode: 'stream' | 'handoff'
  /** Shown to the user when the platform cannot install unattended. */
  instructions?: string
}

/**
 * The seam between "we have a binary" and "this device can install it".
 *
 * Android and iOS do not merely differ in URL — they differ in *kind*. Android
 * accepts the APK bytes and installs them. iOS refuses bytes entirely and will
 * only act on an `itms-services://` link pointing at a manifest describing the
 * build. Modelling that as one port keeps the platform rule in one place
 * instead of spreading `if (ios)` through the catalog service.
 *
 * MarketplaceKit (EU alternative distribution) becomes a third adapter behind
 * this interface once Apple grants the entitlement — see plan 00-overview.
 */
export interface DistributionPort {
  readonly platform: CatalogPlatform
  describe(subject: DistributionSubject, baseUrl: string): InstallDescriptor
}
