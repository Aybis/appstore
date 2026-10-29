import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertValidPackage, InvalidPackageError, kindForExtension } from './package-validator'

/**
 * Builds a REAL zip — local headers, central directory, EOCD — because the
 * validator reads the EOCD to find the central directory. A hand-rolled
 * approximation would pass while the real thing failed, which is exactly what
 * happened to the first version of this validator: it searched a fixed 64 KiB
 * tail, passed every synthetic fixture, and then rejected a genuine 111 MB APK
 * whose central directory was larger than the window.
 */
const buildZip = (names: readonly string[], filler = 0): Buffer => {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const name of names) {
    const nameBytes = Buffer.from(name, 'utf8')
    const body = Buffer.alloc(filler, 0x41)
    const compressed = deflateRawSync(body)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)

    offset += local.length + nameBytes.length + compressed.length
  }

  const localPart = Buffer.concat(locals)
  const centralPart = Buffer.concat(centrals)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(centralPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)

  return Buffer.concat([localPart, centralPart, eocd])
}

describe('assertValidPackage', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'maya-pkg-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const write = async (name: string, contents: Buffer): Promise<string> => {
    const file = path.join(dir, name)
    await writeFile(file, contents)
    return file
  }

  it('accepts a zip carrying AndroidManifest.xml as an apk', async () => {
    const file = await write('ok.apk', buildZip(['AndroidManifest.xml', 'classes.dex']))
    await expect(assertValidPackage(file, 'apk')).resolves.toBeUndefined()
  })

  it('accepts a zip carrying a Payload/ entry as an ipa', async () => {
    const file = await write('ok.ipa', buildZip(['Payload/App.app/Info.plist']))
    await expect(assertValidPackage(file, 'ipa')).resolves.toBeUndefined()
  })

  // The two files that were accepted and PUBLISHED before this existed.
  it('rejects an ELF binary named .apk', async () => {
    const file = await write('elf.apk', Buffer.from('\x7fELF\x02\x01\x01\x00 not a package'))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(InvalidPackageError)
  })

  it('rejects an HTML file named .apk', async () => {
    const file = await write('page.apk', Buffer.from('<html><script>alert(1)</script></html>'))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(/not an APK/i)
  })

  it('rejects an empty file', async () => {
    const file = await write('empty.apk', Buffer.alloc(0))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(/empty file/i)
  })

  it('rejects a file that starts like a zip but has no central directory', async () => {
    const file = await write('truncated.apk', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(/central directory/i)
  })

  // A zip is not automatically a package.
  it('rejects a zip with no required entry', async () => {
    const file = await write('photos.apk', buildZip(['holiday/beach.jpg']))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(/no "AndroidManifest\.xml"/)
  })

  it('rejects an ipa presented as an apk', async () => {
    const file = await write('confused.apk', buildZip(['Payload/App.app/Info.plist']))
    await expect(assertValidPackage(file, 'apk')).rejects.toThrow(InvalidPackageError)
  })

  /**
   * The regression that matters. The manifest is the FIRST entry, so its name
   * sits far from the end of the file — the exact shape that defeated the
   * fixed-tail version and rejected a genuine APK.
   */
  it('finds an entry whose name is far from the end of the file', async () => {
    const names = ['AndroidManifest.xml', ...Array.from({ length: 400 }, (_, i) => `res/layout/view_${i}.xml`)]
    const file = await write('big.apk', buildZip(names, 2048))
    await expect(assertValidPackage(file, 'apk')).resolves.toBeUndefined()
  })
})

describe('kindForExtension', () => {
  it('maps the two extensions the store accepts', () => {
    expect(kindForExtension('.apk')).toBe('apk')
    expect(kindForExtension('.ipa')).toBe('ipa')
  })

  it('refuses anything else', () => {
    expect(() => kindForExtension('.txt')).toThrow(InvalidPackageError)
  })
})
