import fs from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { blobStore, FsBlobStore, S3BlobStore, type BlobStore } from './blob-store'

const read = async (store: BlobStore, key: string): Promise<string | null> => {
  const object = await store.get(key)
  if (!object) return null
  const chunks: Buffer[] = []
  for await (const chunk of object.body) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * The same contract, run against both backends.
 *
 * What matters most is the absent case: every caller turns `null` into a 404
 * or a dedupe decision, so an S3 "not found" that surfaced as a thrown error
 * would turn a missing icon into a 500 and break every first upload.
 */
const contract = (name: string, make: () => BlobStore, scratch: () => string) => {
  describe(name, () => {
    it('round-trips a file and a buffer', async () => {
      const store = make()
      const source = path.join(scratch(), 'source.bin')
      await fs.writeFile(source, 'apk bytes')

      await store.putFile('org/aa/digest.apk', source, 'application/vnd.android.package-archive')
      await store.putBuffer('icons/digest.png', Buffer.from('png bytes'), 'image/png')

      expect(await read(store, 'org/aa/digest.apk')).toBe('apk bytes')
      expect(await read(store, 'icons/digest.png')).toBe('png bytes')
      expect(await store.size('org/aa/digest.apk')).toBe(9)
      // putFile copies; the caller still owns, and removes, its temp file.
      expect(await fs.readFile(source, 'utf8')).toBe('apk bytes')
    })

    it('answers null, not an error, for a missing object', async () => {
      const store = make()
      expect(await store.size('org/aa/absent.apk')).toBeNull()
      expect(await store.get('org/aa/absent.apk')).toBeNull()
    })

    it('refuses a key that climbs out of the store', async () => {
      const store = make()
      await expect(store.get('../etc/passwd')).rejects.toThrow('Invalid storage key')
      await expect(store.get('/etc/passwd')).rejects.toThrow('Invalid storage key')
      await expect(store.size('org//x')).rejects.toThrow('Invalid storage key')
    })
  })
}

let scratchDir: string
beforeEach(async () => {
  scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-blob-'))
  process.env.ARTIFACT_STORE = path.join(scratchDir, 'store')
})
afterEach(async () => {
  delete process.env.ARTIFACT_STORE
  await fs.rm(scratchDir, { recursive: true, force: true })
})

contract('FsBlobStore', () => new FsBlobStore(), () => scratchDir)

describe('FsBlobStore housekeeping', () => {
  it('lists, copies and deletes, leaving no empty folders behind', async () => {
    const store = new FsBlobStore()
    await store.putBuffer('org/app/android/app-1.0.0-aaaa.apk', Buffer.from('apk'))

    await store.copy('org/app/android/app-1.0.0-aaaa.apk', 'org/app/android/moved.apk')
    expect((await store.list()).map((object) => object.key).sort()).toEqual([
      'org/app/android/app-1.0.0-aaaa.apk',
      'org/app/android/moved.apk',
    ])

    await store.delete('org/app/android/app-1.0.0-aaaa.apk')
    await store.delete('org/app/android/moved.apk')
    expect(await store.list()).toEqual([])
    await expect(fs.readdir(path.join(scratchDir, 'store'))).resolves.toEqual([])
  })
})

/**
 * Just enough of S3's path-style REST surface for the calls this store makes:
 * PUT, HEAD and GET on `/<bucket>/<key>`, with S3's own error shape — HEAD
 * answers a bare 404, GET a 404 carrying `<Code>NoSuchKey</Code>`. The SDK
 * maps those two differently, which is exactly what the store has to handle.
 */
const fakeS3 = (): Server => {
  const objects = new Map<string, Buffer>()
  return createServer((req, res) => {
    const key = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        objects.set(key, Buffer.concat(chunks))
        res.writeHead(200, { ETag: '"etag"' }).end()
      })
      return
    }
    const body = objects.get(key)
    if (!body) {
      if (req.method === 'HEAD') return void res.writeHead(404).end()
      return void res
        .writeHead(404, { 'Content-Type': 'application/xml' })
        .end('<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>missing</Message></Error>')
    }
    res.writeHead(200, { 'Content-Length': String(body.length) })
    res.end(req.method === 'HEAD' ? undefined : body)
  })
}

describe('S3', () => {
  let server: Server
  let endpoint: string

  beforeAll(async () => {
    server = fakeS3()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const make = () =>
    new S3BlobStore({
      endpoint,
      region: 'auto',
      bucket: 'artifacts',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    })

  contract('S3BlobStore', make, () => scratchDir)
})

describe('blobStore()', () => {
  afterEach(() => {
    delete process.env.BLOB_STORE
  })

  it('is the filesystem unless told otherwise', () => {
    expect(blobStore()).toBeInstanceOf(FsBlobStore)
  })

  it('names the missing variable rather than failing on first use', () => {
    const names = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]))
    process.env.BLOB_STORE = 's3'
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com'
    process.env.S3_ACCESS_KEY_ID = 'id'
    process.env.S3_SECRET_ACCESS_KEY = 'secret'
    delete process.env.S3_BUCKET
    try {
      expect(() => blobStore()).toThrow('S3_BUCKET must be set when BLOB_STORE=s3')
    } finally {
      for (const name of names) {
        if (saved[name] === undefined) delete process.env[name]
        else process.env[name] = saved[name]
      }
    }
  })
})
