import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

export interface BlobObject {
  body: Readable
  sizeBytes: number
}

/**
 * Where artifact, icon and client-build bytes live.
 *
 * Two backends behind one surface, chosen by BLOB_STORE. The filesystem is
 * what development and the test suite use — no Docker, no MinIO. S3 is what a
 * hosted deployment needs, because a platform like Render gives each deploy a
 * fresh disk: a filesystem store there loses every uploaded build on the next
 * push, and the database keeps pointing at keys that no longer exist.
 *
 * Keys are always `/`-separated and relative — the same string on both
 * backends, so a row written under one still resolves under the other.
 */
export interface BlobStore {
  /** Size in bytes, or null when absent. A HEAD on S3 — no body is fetched. */
  size(key: string): Promise<number | null>
  /** Consumes nothing: the caller still owns `filePath` and removes it. */
  putFile(key: string, filePath: string, contentType: string): Promise<void>
  putBuffer(key: string, bytes: Buffer, contentType: string): Promise<void>
  /** Null when the object is absent, so callers decide what "missing" means. */
  get(key: string): Promise<BlobObject | null>
  /** Every key in the store with its size. Used by `storage:tidy`, never per request. */
  list(): Promise<{ key: string; sizeBytes: number }[]>
  /** Server-side copy; the source stays. */
  copy(from: string, to: string): Promise<void>
  /** Removes an object. Absent is not an error. */
  delete(key: string): Promise<void>
}

/**
 * Resolved per call, not once at module load: a constant captured at import
 * time cannot be redirected by a test, which would make the suite write into
 * the real artifact store.
 */
export const storeRoot = (): string =>
  process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

/**
 * Keys are produced by this codebase — digests and fixed prefixes — never
 * taken from a request. Checked anyway, so a malformed database row or
 * manifest cannot name `../` and reach outside the store on either backend.
 */
const assertSafeKey = (key: string): void => {
  if (!key || key.startsWith('/') || key.split(/[\\/]/).some((part) => part === '..' || part === '')) {
    throw new Error(`Invalid storage key: ${key}`)
  }
}

export class FsBlobStore implements BlobStore {
  private file(key: string): string {
    assertSafeKey(key)
    return path.join(storeRoot(), key)
  }

  async size(key: string): Promise<number | null> {
    const stat = await fs.stat(this.file(key)).catch(() => null)
    return stat?.isFile() ? stat.size : null
  }

  async putFile(key: string, filePath: string): Promise<void> {
    const destination = this.file(key)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(filePath, destination)
  }

  async putBuffer(key: string, bytes: Buffer): Promise<void> {
    const destination = this.file(key)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, bytes)
  }

  async get(key: string): Promise<BlobObject | null> {
    const file = this.file(key)
    const stat = await fs.stat(file).catch(() => null)
    if (!stat?.isFile()) return null
    return { body: createReadStream(file), sizeBytes: stat.size }
  }

  async list(): Promise<{ key: string; sizeBytes: number }[]> {
    const root = storeRoot()
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true }).catch(() => [])
    const files = entries.filter((entry) => entry.isFile())
    return Promise.all(
      files.map(async (entry) => {
        const full = path.join(entry.parentPath, entry.name)
        const key = path.relative(root, full).split(path.sep).join('/')
        return { key, sizeBytes: (await fs.stat(full)).size }
      }),
    )
  }

  async copy(from: string, to: string): Promise<void> {
    const destination = this.file(to)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(this.file(from), destination)
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.file(key), { force: true })
    // Folders are only structure here (S3 has none), so drop the ones left empty.
    const root = storeRoot()
    for (let dir = path.dirname(this.file(key)); dir.startsWith(root) && dir !== root; dir = path.dirname(dir)) {
      if (!(await fs.rmdir(dir).then(() => true, () => false))) break
    }
  }
}

export interface S3Settings {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

/**
 * Any S3-compatible store. Written against Cloudflare R2, which wants region
 * `auto` and an endpoint of `https://<account>.r2.cloudflarestorage.com`.
 */
export class S3BlobStore implements BlobStore {
  private readonly client: S3Client

  constructor(private readonly settings: S3Settings) {
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    })
  }

  async size(key: string): Promise<number | null> {
    assertSafeKey(key)
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      )
      return head.ContentLength ?? 0
    } catch (error) {
      if (error instanceof NotFound || error instanceof NoSuchKey) return null
      throw error
    }
  }

  async putFile(key: string, filePath: string, contentType: string): Promise<void> {
    assertSafeKey(key)
    // Upload, not PutObject: builds run to hundreds of megabytes, and a single
    // PUT tops out at 5 GB while holding the whole request open. Upload splits
    // anything large into parts and retries a failed part on its own.
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.settings.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
      },
    }).done()
  }

  async putBuffer(key: string, bytes: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key)
    await new Upload({
      client: this.client,
      params: { Bucket: this.settings.bucket, Key: key, Body: bytes, ContentType: contentType },
    }).done()
  }

  async get(key: string): Promise<BlobObject | null> {
    assertSafeKey(key)
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      )
      return { body: object.Body as Readable, sizeBytes: object.ContentLength ?? 0 }
    } catch (error) {
      if (error instanceof NoSuchKey || error instanceof NotFound) return null
      throw error
    }
  }

  async list(): Promise<{ key: string; sizeBytes: number }[]> {
    const objects: { key: string; sizeBytes: number }[] = []
    let token: string | undefined
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.settings.bucket, ContinuationToken: token }),
      )
      for (const object of page.Contents ?? []) {
        if (object.Key) objects.push({ key: object.Key, sizeBytes: object.Size ?? 0 })
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
    return objects
  }

  async copy(from: string, to: string): Promise<void> {
    assertSafeKey(from)
    assertSafeKey(to)
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.settings.bucket,
        Key: to,
        // Each segment encoded on its own: the slashes are the key's structure.
        CopySource: `${this.settings.bucket}/${from.split('/').map(encodeURIComponent).join('/')}`,
      }),
    )
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }))
  }
}

let s3: S3BlobStore | null = null

/**
 * The store this process uses.
 *
 * The filesystem store is built fresh each call because it is free and must
 * follow ARTIFACT_STORE when a test moves it. The S3 store is built once: its
 * client holds a connection pool that should outlive any one request.
 */
export const blobStore = (): BlobStore => {
  if (process.env.BLOB_STORE !== 's3') return new FsBlobStore()

  s3 ??= new S3BlobStore({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'auto',
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  })
  return s3
}

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set when BLOB_STORE=s3`)
  return value
}
