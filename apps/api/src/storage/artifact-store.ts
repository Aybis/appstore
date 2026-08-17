import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Injectable } from '@nestjs/common'

export interface StoredArtifact {
  /** Path within the store, derived from the digest — never from user input. */
  storageKey: string
  sha256: string
  sizeBytes: number
  /** True when an identical object was already present for this org. */
  deduplicated: boolean
}

/**
 * Resolved per call, not once at module load: a constant captured at import
 * time cannot be redirected by a test, which would make the suite write into
 * the real artifact store.
 */
export const storeRoot = (): string =>
  process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

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
   * Moves an uploaded temp file into the store. The temp file is consumed:
   * on success it has been renamed, on failure it is removed.
   */
  async put(orgId: string, tempPath: string, extension: string): Promise<StoredArtifact> {
    try {
      const [sha256, stat] = await Promise.all([
        this.digest(tempPath),
        fs.stat(tempPath),
      ])

      const storageKey = path.join(orgId, sha256.slice(0, 2), `${sha256}${extension}`)
      const destination = path.join(storeRoot(), storageKey)

      const existing = await fs
        .stat(destination)
        .then(() => true)
        .catch(() => false)

      if (existing) {
        // Same bytes already stored for this org — keep the original object.
        await fs.rm(tempPath, { force: true })
        return { storageKey, sha256, sizeBytes: stat.size, deduplicated: true }
      }

      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.rename(tempPath, destination).catch(async (error: unknown) => {
        // rename fails across filesystems (temp dir on a different mount).
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
        await fs.copyFile(tempPath, destination)
        await fs.rm(tempPath, { force: true })
      })

      return { storageKey, sha256, sizeBytes: stat.size, deduplicated: false }
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
