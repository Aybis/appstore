import { Injectable } from '@nestjs/common'
import type {
  DistributionPort,
  DistributionSubject,
  InstallDescriptor,
} from './distribution.port'
import type { CatalogPlatform } from '../catalog/catalog.service'

/** XML text nodes: these five are the only characters that can break a plist. */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * iOS in-house / ad-hoc distribution.
 *
 * iOS will not install an IPA from a link. Safari must open an
 * `itms-services://` URL whose `url` parameter points at a manifest plist
 * describing the build; the OS then fetches the IPA named inside it.
 *
 * Two hard requirements that are easy to miss and fail opaquely:
 *
 *   1. BOTH the manifest URL and the IPA URL inside it must be **HTTPS with a
 *      certificate iOS trusts**. Plain HTTP is refused with no useful error, so
 *      this adapter reports when it has been handed a non-HTTPS base.
 *   2. The IPA must be signed for ad-hoc (device UDID in the profile) or
 *      enterprise in-house distribution. An App Store IPA is FairPlay-encrypted
 *      and will never install, however the manifest is served.
 *
 * Neither is something the server can fix, so both surface as `instructions`
 * rather than being silently ignored.
 */
@Injectable()
export class ItmsServicesAdapter implements DistributionPort {
  readonly platform: CatalogPlatform = 'ios'

  describe(subject: DistributionSubject, baseUrl: string): InstallDescriptor {
    const manifestUrl = subject.manifestUrl ?? `${baseUrl}/download/manifest.plist`
    const secure = manifestUrl.startsWith('https://')

    return {
      // Safari opens this; iOS then fetches the manifest and the IPA it names.
      url: `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`,
      mode: 'handoff',
      ...(secure
        ? {}
        : {
            instructions:
              'This server is reachable over HTTP only. iOS refuses an ' +
              'itms-services manifest that is not served over HTTPS with a ' +
              'trusted certificate, so installation will not start until MAYA ' +
              'is published behind TLS (set PUBLIC_BASE_URL).',
          }),
    }
  }

  /**
   * The manifest plist itself.
   *
   * `display-image` / `full-size-image` are deliberately omitted: the catalog
   * stores no real per-app artwork (icons are generated client-side from the
   * slug), and pointing at URLs that 404 makes iOS show a broken placeholder
   * rather than its own generic one.
   */
  manifest(subject: DistributionSubject): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>sha256</key>
          <string>${escapeXml(subject.sha256)}</string>
          <key>url</key>
          <string>${escapeXml(subject.artifactUrl)}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${escapeXml(subject.packageId)}</string>
        <key>bundle-version</key>
        <string>${escapeXml(subject.version)}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${escapeXml(subject.appName)}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
`
  }
}
