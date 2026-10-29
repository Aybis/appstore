import { createHash } from 'node:crypto'
import { open, type FileHandle } from 'node:fs/promises'
import { promisify } from 'node:util'
import { inflateRaw } from 'node:zlib'

const inflate = promisify(inflateRaw)

/**
 * What the download portal needs to say about an Android build, read from the
 * APK itself.
 *
 * These values are printed on a public page: a wrong minimum Android version
 * sends people to an install that fails on their device, and a wrong signer
 * fingerprint teaches them to ignore the one check a sideloaded build gets. So
 * nothing here is typed in by a person, and nothing is guessed — anything that
 * cannot be read is an error, not a default.
 *
 * Dependency-free, like package-validator.ts and for the same reason: this
 * reads files strangers upload, and a hand-rolled reader that never follows an
 * entry's claimed size past the limits below has less surface than a library
 * that does. It was checked against aapt2 and apksigner on a real build.
 */
export interface ApkInfo {
  packageId: string
  versionName: string
  versionCode: number
  minSdk: number
  abis: string[]
  /** SHA-256 of the first signer's certificate, lowercase hex — what apksigner prints. */
  signerSha256: string
}

export class ApkReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApkReadError'
  }
}

/** A real AndroidManifest.xml is tens of KB; this only stops a hostile claim. */
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024
const MAX_CENTRAL_DIRECTORY_BYTES = 32 * 1024 * 1024
const EOCD_SEARCH_BYTES = 65535 + 22

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

const readAt = async (file: FileHandle, position: number, length: number): Promise<Buffer> => {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await file.read(buffer, 0, length, position)
  if (bytesRead !== length) throw new ApkReadError('The file ends before the APK structure does')
  return buffer
}

interface Directory {
  entries: ZipEntry[]
  centralDirectoryOffset: number
}

const readDirectory = async (file: FileHandle, size: number): Promise<Directory> => {
  const windowSize = Math.min(size, EOCD_SEARCH_BYTES)
  const tail = await readAt(file, size - windowSize, windowSize)
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd === -1) throw new ApkReadError('Not a zip archive')

  const count = tail.readUInt16LE(eocd + 10)
  const directorySize = tail.readUInt32LE(eocd + 12)
  const directoryOffset = tail.readUInt32LE(eocd + 16)
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new ApkReadError('Zip64 archives are not supported')
  }
  if (directorySize > MAX_CENTRAL_DIRECTORY_BYTES || directoryOffset + directorySize > size) {
    throw new ApkReadError('The zip directory is out of range')
  }

  const directory = await readAt(file, directoryOffset, directorySize)
  const entries: ZipEntry[] = []
  let cursor = 0
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) {
      throw new ApkReadError('The zip directory is malformed')
    }
    const nameLength = directory.readUInt16LE(cursor + 28)
    const extraLength = directory.readUInt16LE(cursor + 30)
    const commentLength = directory.readUInt16LE(cursor + 32)
    entries.push({
      method: directory.readUInt16LE(cursor + 10),
      compressedSize: directory.readUInt32LE(cursor + 20),
      uncompressedSize: directory.readUInt32LE(cursor + 24),
      localHeaderOffset: directory.readUInt32LE(cursor + 42),
      name: directory.toString('utf8', cursor + 46, cursor + 46 + nameLength),
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return { entries, centralDirectoryOffset: directoryOffset }
}

const readEntry = async (file: FileHandle, entry: ZipEntry, limit: number): Promise<Buffer> => {
  if (entry.uncompressedSize > limit) throw new ApkReadError(`${entry.name} is unreasonably large`)
  const header = await readAt(file, entry.localHeaderOffset, 30)
  if (header.readUInt32LE(0) !== 0x04034b50) throw new ApkReadError('A zip entry header is malformed')
  const dataStart = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
  const raw = await readAt(file, dataStart, entry.compressedSize)
  if (entry.method === 0) return raw
  if (entry.method === 8) return inflate(raw)
  throw new ApkReadError(`${entry.name} uses an unsupported compression method`)
}

/**
 * Binary AndroidManifest.xml. Only the two elements and four attributes the
 * portal states are read; everything else in the file is skipped, not parsed.
 */
const readManifestAttributes = (xml: Buffer): Map<string, string | number> => {
  if (xml.length < 8 || xml.readUInt16LE(0) !== 0x0003) {
    throw new ApkReadError('AndroidManifest.xml is not binary XML')
  }

  let strings: string[] = []
  const found = new Map<string, string | number>()
  let cursor = xml.readUInt16LE(2)

  while (cursor + 8 <= xml.length) {
    const type = xml.readUInt16LE(cursor)
    const size = xml.readUInt32LE(cursor + 4)
    if (size < 8 || cursor + size > xml.length) throw new ApkReadError('AndroidManifest.xml is truncated')

    if (type === 0x0001) {
      strings = readStringPool(xml, cursor)
    } else if (type === 0x0102) {
      const elementName = strings[xml.readUInt32LE(cursor + 20)]
      const attributeStart = xml.readUInt16LE(cursor + 24)
      const attributeSize = xml.readUInt16LE(cursor + 26)
      const attributeCount = xml.readUInt16LE(cursor + 28)

      if (elementName === 'manifest' || elementName === 'uses-sdk') {
        for (let index = 0; index < attributeCount; index += 1) {
          const at = cursor + 16 + attributeStart + index * attributeSize
          const name = strings[xml.readUInt32LE(at + 4)]
          const rawValue = xml.readInt32LE(at + 8)
          const dataType = xml.readUInt8(at + 15)
          const data = xml.readUInt32LE(at + 16)
          if (name === undefined) continue
          const value = dataType === 0x03 ? strings[rawValue === -1 ? data : rawValue] : data
          if (value !== undefined) found.set(`${elementName}:${name}`, value)
        }
      }
    }
    cursor += size
  }
  return found
}

const readStringPool = (xml: Buffer, at: number): string[] => {
  const headerSize = xml.readUInt16LE(at + 2)
  const count = xml.readUInt32LE(at + 8)
  const flags = xml.readUInt32LE(at + 16)
  const stringsStart = xml.readUInt32LE(at + 20)
  const utf8 = (flags & 0x100) !== 0
  const strings: string[] = []

  for (let index = 0; index < count; index += 1) {
    const offset = at + stringsStart + xml.readUInt32LE(at + headerSize + index * 4)
    if (utf8) {
      let cursor = offset
      // Two lengths, each one or two bytes: characters, then bytes.
      if (xml.readUInt8(cursor) & 0x80) cursor += 2
      else cursor += 1
      let byteLength = xml.readUInt8(cursor)
      if (byteLength & 0x80) {
        byteLength = ((byteLength & 0x7f) << 8) | xml.readUInt8(cursor + 1)
        cursor += 2
      } else {
        cursor += 1
      }
      strings.push(xml.toString('utf8', cursor, cursor + byteLength))
    } else {
      let length = xml.readUInt16LE(offset)
      let cursor = offset + 2
      if (length & 0x8000) {
        length = ((length & 0x7fff) << 16) | xml.readUInt16LE(cursor)
        cursor += 2
      }
      strings.push(xml.toString('utf16le', cursor, cursor + length * 2))
    }
  }
  return strings
}

const SIGNING_BLOCK_MAGIC = Buffer.from('APK Sig Block 42', 'ascii')
const SIGNATURE_SCHEME_IDS = [0xf05368c0, 0x7109871a] // v3, then v2

/**
 * The first signer's certificate from the APK Signing Block (scheme v2 or v3).
 *
 * v1 (META-INF) signatures are not read: a v1-only APK is refused instead of
 * being given a fingerprint taken from somewhere else. Android 7 and newer, which
 * is everything MAYA supports, signs with v2 or later.
 */
const readSignerSha256 = async (file: FileHandle, centralDirectoryOffset: number): Promise<string> => {
  if (centralDirectoryOffset < 32) throw new ApkReadError('The APK has no signing block')
  const footer = await readAt(file, centralDirectoryOffset - 24, 24)
  if (!footer.subarray(8).equals(SIGNING_BLOCK_MAGIC)) {
    throw new ApkReadError('The APK is not signed with signature scheme v2 or newer')
  }
  const blockSize = Number(footer.readBigUInt64LE(0))
  if (blockSize < 32 || blockSize > 64 * 1024 * 1024 || blockSize + 8 > centralDirectoryOffset) {
    throw new ApkReadError('The APK signing block is malformed')
  }

  // The block is size(8) + pairs + size(8) + magic(16), and `blockSize` counts everything
  // but the leading size field. The pairs therefore start `blockSize` bytes before the
  // central directory.
  const block = await readAt(file, centralDirectoryOffset - blockSize, blockSize - 24)
  const pairs = new Map<number, Buffer>()
  let cursor = 0
  while (cursor + 12 <= block.length) {
    const pairLength = Number(block.readBigUInt64LE(cursor))
    if (pairLength < 4 || cursor + 8 + pairLength > block.length) break
    pairs.set(block.readUInt32LE(cursor + 8), block.subarray(cursor + 12, cursor + 8 + pairLength))
    cursor += 8 + pairLength
  }

  for (const id of SIGNATURE_SCHEME_IDS) {
    const value = pairs.get(id)
    if (!value) continue
    const certificate = firstCertificate(value)
    if (certificate) return createHash('sha256').update(certificate).digest('hex')
  }
  throw new ApkReadError('The APK has no readable signer certificate')
}

/** Walks signers -> signer -> signed data -> certificates -> first certificate. */
const firstCertificate = (value: Buffer): Buffer | null => {
  const lengthPrefixed = (buffer: Buffer, at: number): [Buffer, number] | null => {
    if (at + 4 > buffer.length) return null
    const length = buffer.readUInt32LE(at)
    if (at + 4 + length > buffer.length) return null
    return [buffer.subarray(at + 4, at + 4 + length), at + 4 + length]
  }

  const signers = lengthPrefixed(value, 0)
  const signer = signers && lengthPrefixed(signers[0], 0)
  const signedData = signer && lengthPrefixed(signer[0], 0)
  if (!signedData) return null
  const digests = lengthPrefixed(signedData[0], 0)
  const certificates = digests && lengthPrefixed(signedData[0], digests[1])
  const first = certificates && lengthPrefixed(certificates[0], 0)
  return first ? first[0] : null
}

/** Android API level to the version name a person recognises. */
const ANDROID_NAMES: Record<number, string> = {
  21: 'Android 5.0', 22: 'Android 5.1', 23: 'Android 6.0', 24: 'Android 7.0',
  25: 'Android 7.1', 26: 'Android 8.0', 27: 'Android 8.1', 28: 'Android 9',
  29: 'Android 10', 30: 'Android 11', 31: 'Android 12', 32: 'Android 12L',
  33: 'Android 13', 34: 'Android 14', 35: 'Android 15', 36: 'Android 16',
}

export const androidLabel = (minSdk: number): string =>
  ANDROID_NAMES[minSdk] ?? `Android (API ${minSdk})`

export const readApkInfo = async (filePath: string): Promise<ApkInfo> => {
  const file = await open(filePath, 'r')
  try {
    const { size } = await file.stat()
    if (size < 22) throw new ApkReadError('Not a zip archive')
    const { entries, centralDirectoryOffset } = await readDirectory(file, size)

    const manifestEntry = entries.find((entry) => entry.name === 'AndroidManifest.xml')
    if (!manifestEntry) throw new ApkReadError('The file has no AndroidManifest.xml, so it is not an APK')
    const attributes = readManifestAttributes(
      await readEntry(file, manifestEntry, MAX_MANIFEST_BYTES),
    )

    const need = <T extends string | number>(key: string, label: string, kind: 'string' | 'number'): T => {
      const value = attributes.get(key)
      if (typeof value !== kind) throw new ApkReadError(`Could not read ${label} from the APK`)
      return value as T
    }

    const abis = [
      ...new Set(
        entries.flatMap((entry) => {
          const match = /^lib\/([^/]+)\/[^/]+\.so$/.exec(entry.name)
          return match?.[1] ? [match[1]] : []
        }),
      ),
    ].sort()

    return {
      packageId: need<string>('manifest:package', 'the package name', 'string'),
      versionName: need<string>('manifest:versionName', 'versionName', 'string'),
      versionCode: need<number>('manifest:versionCode', 'versionCode', 'number'),
      minSdk: need<number>('uses-sdk:minSdkVersion', 'minSdkVersion', 'number'),
      abis,
      signerSha256: await readSignerSha256(file, centralDirectoryOffset),
    }
  } finally {
    await file.close()
  }
}
