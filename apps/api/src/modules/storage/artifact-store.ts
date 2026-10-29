import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Injectable } from '@nestjs/common'

import { blobStore } from './blob-store'

export { storeRoot } from './blob-store'

/** What an artifact's storage key is built from — all of it already in the database. */
export interface ArtifactLocation {
  orgSlug: string
  appSlug: string
  platform: string
  version: string
  sha256: string
  /** `.apk` or `.ipa`, with the dot. */
  extension: string
}

/**
 * Where a build lives in the store:
 *
 *   <org-slug>/<app-slug>/<platform>/<app-slug>-<version>-<sha8><ext>
 *   maya/hr-portal/android/hr-portal-3.2.1-624b51b7.apk
 *
 * Every part maps to a row: organizations.slug, apps.slug, releases.platform,
 * releases.version and artifacts.sha256 — so anybody browsing the bucket can
 * tell which release a file belongs to, and the row's storage_key says where
 * its file is.
 *
 * The digest suffix means different bytes can never land on the same key,
 * even for the same version: a rejected re-upload cannot overwrite the file a
 * published release already points at.
 */
export const artifactKey = (at: ArtifactLocation): string => {
  const segment = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, '-')
  const app = segment(at.appSlug)
  return [
    segment(at.orgSlug),
    app,
    segment(at.platform),
    `${app}-${segment(at.version)}-${at.sha256.slice(0, 8)}${at.extension}`,
  ].join('/')
}

export interface StoredArtifact {
  storageKey: string
  sha256: string
  sizeBytes: number
  /** True when these bytes were already stored, so nothing new was written. */
  deduplicated: boolean
}

export const contentTypeFor = (extension: string): string =>
  extension === '.apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream'

/** Streams the file so a 200 MB APK is never held in memory. */
export const sha256OfFile = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/**
 * Build storage: exactly one object per distinct build in an organization.
 *
 * The digest is computed here from what actually landed on disk, never
 * trusted from the uploader — a client-supplied digest would let a caller
 * store one binary under another's name.
 */
@Injectable()
export class ArtifactStore {
  /**
   * Moves an uploaded temp file into the store. The temp file is consumed: it
   * is removed whether the copy succeeded or not.
   *
   * `existingKey` looks up whether this organization already stores these
   * exact bytes (a build re-tagged as a new version). If so that object is
   * reused, so the bucket never holds two copies of one build.
   */
  async put(
    tempPath: string,
    location: Omit<ArtifactLocation, 'sha256'>,
    existingKey: (sha256: string) => Promise<string | null>,
  ): Promise<StoredArtifact> {
    try {
      const [sha256, stat] = await Promise.all([sha256OfFile(tempPath), fs.stat(tempPath)])
      const store = blobStore()

      const reused = await existingKey(sha256)
      if (reused && (await store.size(reused)) !== null) {
        return { storageKey: reused, sha256, sizeBytes: stat.size, deduplicated: true }
      }

      const storageKey = artifactKey({ ...location, sha256 })
      if ((await store.size(storageKey)) === null) {
        await store.putFile(storageKey, tempPath, contentTypeFor(location.extension))
      }
      return { storageKey, sha256, sizeBytes: stat.size, deduplicated: false }
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }
}
