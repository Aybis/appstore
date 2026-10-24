import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Injectable } from '@nestjs/common'

import { blobStore } from './blob-store'

export { storeRoot } from './blob-store'

export interface StoredArtifact {
  /** Path within the store, derived from the digest — never from user input. */
  storageKey: string
  sha256: string
  sizeBytes: number
  /** True when an identical object was already present for this org. */
  deduplicated: boolean
}

/**
 * Content-addressed artifact storage.
 *
 * The key is the SHA-256 of the bytes, computed here from what actually landed
 * on disk rather than trusted from the uploader — a client-supplied digest
 * would let a caller store one binary under another's name.
 *
 * Addressing is per-org (`<orgId>/<aa>/<sha256><ext>`) so two tenants uploading
 * an identical file each keep their own object and neither can probe for the
 * other's existence by digest.
 */
@Injectable()
export class ArtifactStore {
  /** Streams the file to avoid holding a 200 MB APK in memory. */
  private async digest(filePath: string): Promise<string> {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(filePath)) {
      hash.update(chunk as Buffer)
    }
    return hash.digest('hex')
  }

  /**
   * Copies an uploaded temp file into the store. The temp file is consumed:
   * it is removed whether the copy succeeded or not.
   */
  async put(orgId: string, tempPath: string, extension: string): Promise<StoredArtifact> {
    try {
      const [sha256, stat] = await Promise.all([
        this.digest(tempPath),
        fs.stat(tempPath),
      ])

      // posix.join, so the key is `/`-separated on every OS — it is an object
      // name on S3, not only a path.
      const storageKey = path.posix.join(orgId, sha256.slice(0, 2), `${sha256}${extension}`)
      const store = blobStore()

      if ((await store.size(storageKey)) !== null) {
        // Same bytes already stored for this org — keep the original object.
        return { storageKey, sha256, sizeBytes: stat.size, deduplicated: true }
      }

      await store.putFile(storageKey, tempPath, contentTypeFor(extension))
      return { storageKey, sha256, sizeBytes: stat.size, deduplicated: false }
    } finally {
      // The temp file is ours on every path: copied into the store, already
      // there, or failed.
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }
}

const contentTypeFor = (extension: string): string =>
  extension === '.apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream'
