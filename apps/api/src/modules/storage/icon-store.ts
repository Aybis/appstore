import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { BadRequestException, Injectable } from '@nestjs/common'

import { blobStore, type BlobObject } from './blob-store'

/** An icon is small by definition. Anything larger is a screenshot by mistake. */
const MAX_ICON_BYTES = 1024 * 1024

/**
 * Magic bytes, not the declared MIME type or the file extension.
 *
 * Both of those come from the client and neither is evidence. The same
 * reasoning as package-validator.ts: what a file claims to be and what it is
 * are different questions, and only one of them is checked here.
 */
const SIGNATURES: { ext: string; contentType: string; matches: (bytes: Buffer) => boolean }[] = [
  {
    ext: '.png',
    contentType: 'image/png',
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: '.jpg',
    contentType: 'image/jpeg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: '.webp',
    contentType: 'image/webp',
    // "RIFF" .... "WEBP" — the size field sits between the two markers.
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
]

export interface StoredIcon {
  /** `<sha256><ext>` — the name the public route serves it under. */
  key: string
  contentType: string
  sizeBytes: number
}

/**
 * Content-addressed storage for app icons.
 *
 * Separate from ArtifactStore because the addressing rule is deliberately
 * different. Artifacts are scoped per org (`<orgId>/<aa>/<sha256>`) so one
 * tenant cannot probe for another's binaries by digest. Icons are NOT: they are
 * shared by digest across the whole deployment, because the icon route has to
 * be public — an `<img>` tag cannot send an Authorization header, and putting
 * a token in the URL to work around that would be worse than anything this
 * protects.
 *
 * That trade is only acceptable because of what an icon is: a picture the
 * company chose to represent an app, revealing nothing a catalog listing does
 * not already. The digest is unguessable, so the URL discloses no org, no app
 * and no slug.
 */
@Injectable()
export class IconStore {
  async put(tempPath: string): Promise<StoredIcon> {
    try {
      const stat = await fs.stat(tempPath)
      if (stat.size > MAX_ICON_BYTES) {
        throw new BadRequestException('Icon must be 1 MB or smaller')
      }

      const bytes = await fs.readFile(tempPath)
      const signature = SIGNATURES.find((candidate) => candidate.matches(bytes))
      if (!signature) {
        throw new BadRequestException('Icon must be a PNG, JPEG or WebP image')
      }

      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const key = `${sha256}${signature.ext}`
      const store = blobStore()

      // Same bytes, same name — writing again would be identical work.
      if ((await store.size(`icons/${key}`)) === null) {
        await store.putBuffer(`icons/${key}`, bytes, signature.contentType)
      }

      return { key, contentType: signature.contentType, sizeBytes: bytes.length }
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }

  /**
   * Opens an icon by its public name, refusing anything that is not a plain
   * digest name. Null for a malformed name and for a missing one alike — the
   * route answers 404 either way.
   */
  async open(key: string): Promise<(BlobObject & { contentType: string }) | null> {
    const match = /^([0-9a-f]{64})(\.png|\.jpg|\.webp)$/.exec(key)
    // Shape-checked rather than path-resolved: a name that is not 64 hex
    // characters plus a known extension never reaches the store at all, so
    // there is no traversal to defend against further down.
    if (!match) return null

    const signature = SIGNATURES.find((candidate) => candidate.ext === match[2])
    if (!signature) return null

    const object = await blobStore().get(`icons/${key}`)
    return object ? { ...object, contentType: signature.contentType } : null
  }
}
