import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'

import { blobStore } from '../storage/blob-store'

/** The only platforms that may be named in a URL. Never joined from raw input. */
export const CLIENT_PLATFORMS = ['android', 'ios'] as const
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number]

export const isClientPlatform = (value: string): value is ClientPlatform =>
  (CLIENT_PLATFORMS as readonly string[]).includes(value)

export interface ManifestEntry {
  version: string
  versionCode: number
  /** The build's key in the store: the release artifact's storage_key. */
  storageKey?: string
  /** Older manifests: a copy under `client/`. Read, never written any more. */
  file?: string
  sha256: string
  sizeBytes: number
  packageId: string
  minSdk: number
  minOsLabel: string
  abis: string[]
  signerSha256: string
  releasedAt: string
  /** Where the build came from: a CLI path/URL, or `console:<releaseId>`. */
  source?: string
  easBuildId?: string
  gitCommit?: string
}

/** What the portal is allowed to see. Deliberately not the whole entry. */
export interface ClientBuild {
  platform: ClientPlatform
  version: string
  versionCode: number
  sizeBytes: number
  sha256: string
  packageId: string
  minOsLabel: string
  abis: string[]
  releasedAt: string
}

export interface ResolvedDownload {
  body: Readable
  filename: string
  sizeBytes: number
  contentType: string
}

/**
 * The MAYA client itself — the bootstrap problem the catalog cannot solve.
 *
 * Everything else in this API answers "which apps may this person install?",
 * which presumes MAYA is already on the device. Nothing answers "how does MAYA
 * get there in the first place", and a store you can only reach from inside
 * itself is not reachable at all.
 *
 * NOT A CATALOG APP, on purpose. Catalog rows are tenant data under RLS,
 * scoped to an org, and reached with a bearer token. The client build is none
 * of those: it is one binary belonging to this deployment, identical for every
 * org, and it has to be fetchable by somebody holding a phone with no app and
 * no session. Modelling it as tenant data would mean inventing a tenant for it.
 *
 * It is a DEPLOY ARTIFACT, so it lives in the blob store beside a manifest rather than in
 * Postgres — it ships and versions with the release, and there is no admin
 * screen to build because nobody uploads it: CI does, from EAS.
 */
@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name)

  /** Digests are computed once per process, then reused — see verify() below. */
  private readonly verified = new Map<ClientPlatform, string>()

  /** Under `client/`, whichever backend BLOB_STORE picks. */
  private key(file: string): string {
    return path.posix.join('client', file)
  }

  /**
   * Where the entry's bytes are. The key comes from our own manifest rather
   * than a request, but it is checked anyway so a bad manifest cannot name
   * anything outside the store (the blob store rejects `..` keys too).
   */
  private buildKey(entry: ManifestEntry): string {
    const key = entry.storageKey ?? (entry.file ? this.key(path.posix.normalize(entry.file)) : '')
    if (!key || path.posix.isAbsolute(key) || key.split('/').includes('..')) {
      throw new ServiceUnavailableException('Client build path is invalid')
    }
    return key
  }

  private async readText(file: string): Promise<string | null> {
    const object = await blobStore().get(this.key(file))
    if (!object) return null
    const chunks: Buffer[] = []
    for await (const chunk of object.body) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString('utf8')
  }

  private async manifest(): Promise<Partial<Record<ClientPlatform, ManifestEntry | null>>> {
    try {
      const text = await this.readText('manifest.json')
      if (text === null) return {}
      return JSON.parse(text) as Partial<
        Record<ClientPlatform, ManifestEntry | null>
      >
    } catch {
      // No manifest is a legitimate state — a deployment that has not published
      // a client build yet — so the portal gets an empty list, not a 500.
      return {}
    }
  }

  private entry(
    manifest: Partial<Record<ClientPlatform, ManifestEntry | null>>,
    platform: ClientPlatform,
  ): ManifestEntry | null {
    return manifest[platform] ?? null
  }

  private describe(platform: ClientPlatform, entry: ManifestEntry): ClientBuild {
    return {
      platform,
      version: entry.version,
      versionCode: entry.versionCode,
      sizeBytes: entry.sizeBytes,
      sha256: entry.sha256,
      packageId: entry.packageId,
      minOsLabel: entry.minOsLabel,
      abis: entry.abis,
      releasedAt: entry.releasedAt,
    }
  }

  /** Every platform that currently has a build, for the portal's download panel. */
  async available(): Promise<ClientBuild[]> {
    const manifest = await this.manifest()
    return CLIENT_PLATFORMS.flatMap((platform) => {
      const entry = this.entry(manifest, platform)
      return entry ? [this.describe(platform, entry)] : []
    })
  }

  /**
   * Resolves a platform to a stored file, having CHECKED the bytes.
   *
   * The portal prints a SHA-256 next to the download and tells people to
   * compare it, which is the only verification a sideloaded APK gets —
   * Android will happily install a tampered build, and the browser will
   * happily deliver one. A fingerprint the server never checks against the
   * bytes it serves is decoration: it would still read as correct while the
   * file underneath it had been replaced.
   *
   * So the digest is computed from the file on first request and compared with
   * the manifest. A mismatch takes the download offline rather than serving a
   * binary we cannot vouch for — the loud failure is the point.
   */
  async resolve(platform: ClientPlatform): Promise<ResolvedDownload> {
    const entry = this.entry(await this.manifest(), platform)
    if (!entry) throw new NotFoundException(`No MAYA build published for ${platform}`)

    const key = this.buildKey(entry)

    const size = await blobStore().size(key)
    if (size === null) throw new NotFoundException('Client build is missing from the store')

    await this.verify(platform, key, entry, size)

    // Opened after verification so the bytes served are a fresh read, not a
    // stream consumed by hashing.
    const object = await blobStore().get(key)
    if (!object) throw new NotFoundException('Client build is missing from the store')

    return {
      body: object.body,
      filename: `maya-${entry.version}.${platform === 'android' ? 'apk' : 'ipa'}`,
      sizeBytes: object.sizeBytes,
      contentType:
        platform === 'android'
          ? 'application/vnd.android.package-archive'
          : 'application/octet-stream',
    }
  }

  private async verify(
    platform: ClientPlatform,
    key: string,
    entry: ManifestEntry,
    actualSize: number,
  ): Promise<void> {
    const cached = this.verified.get(platform)
    if (cached === entry.sha256) return

    // Cheap check first: a size mismatch cannot be a matching digest, and it
    // saves hashing 100 MB to learn what stat already proved.
    if (actualSize !== entry.sizeBytes) {
      this.logger.error(
        `Client build for ${platform} is ${actualSize} bytes, manifest says ${entry.sizeBytes}`,
      )
      throw new ServiceUnavailableException('Client build failed verification')
    }

    const object = await blobStore().get(key)
    if (!object) throw new NotFoundException('Client build is missing from the store')
    const hash = createHash('sha256')
    for await (const chunk of object.body) hash.update(chunk as Buffer)
    const digest = hash.digest('hex')

    if (digest !== entry.sha256) {
      this.logger.error(
        `Client build for ${platform} hashes to ${digest}, manifest says ${entry.sha256}`,
      )
      throw new ServiceUnavailableException('Client build failed verification')
    }

    this.verified.set(platform, digest)
  }
}

/**
 * Picks the URL the install QR code should encode.
 *
 * Exported and pure so the loopback rule is testable — it is the part most
 * likely to be got wrong, and wrong here is invisible until somebody's phone
 * fails to open the link.
 */
export const resolvePortalUrl = (portalUrl: string, corsOrigins: string[]): string | null => {
  if (portalUrl) return portalUrl.replace(/\/$/, '')

  const reachable = corsOrigins.find((origin) => !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(origin))

  // No non-loopback origin means every candidate URL is one only this machine
  // can open. Returning null suppresses the QR entirely, so the portal says
  // "set PORTAL_URL" rather than rendering a code that cannot work.
  return reachable ? reachable.replace(/\/$/, '') : null
}
