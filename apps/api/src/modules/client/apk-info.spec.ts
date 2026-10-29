import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { androidLabel, ApkReadError, readApkInfo } from './apk-info'

/** A zip holding a single stored (uncompressed) entry. Enough to exercise the reader. */
const zipWith = (name: string, content: Buffer): Buffer => {
  const nameBytes = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(nameBytes.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt32LE(content.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(nameBytes.length, 28)
  central.writeUInt32LE(0, 42)
  const body = Buffer.concat([local, nameBytes, content])
  const directory = Buffer.concat([central, nameBytes])
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(body.length, 16)
  return Buffer.concat([body, directory, end])
}

describe('readApkInfo', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'apk-info-'))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const readFrom = async (name: string, bytes: Buffer) => {
    const file = path.join(dir, name)
    await writeFile(file, bytes)
    return readApkInfo(file)
  }

  it('refuses a file that is not a zip', async () => {
    await expect(readFrom('text.apk', Buffer.from('<html>definitely not an apk</html>'))).rejects.toThrow(
      ApkReadError,
    )
  })

  it('refuses a zip with no AndroidManifest.xml', async () => {
    await expect(readFrom('photos.apk', zipWith('holiday.jpg', Buffer.from('x')))).rejects.toThrow(
      /no AndroidManifest\.xml/,
    )
  })

  it('refuses a manifest that is not binary XML', async () => {
    await expect(
      readFrom('plain.apk', zipWith('AndroidManifest.xml', Buffer.from('<manifest package="a.b"/>'))),
    ).rejects.toThrow(/not binary XML/)
  })
})

describe('androidLabel', () => {
  it('names a known API level', () => {
    expect(androidLabel(24)).toBe('Android 7.0')
  })

  it('says the API level for one it does not know, rather than inventing a version', () => {
    expect(androidLabel(99)).toBe('Android (API 99)')
  })
})
