import { open, stat } from 'node:fs/promises'

/**
 * Verifies that an uploaded file is actually the kind of package it claims.
 *
 * Before this, upload validation was the filename extension and nothing else,
 * so an ELF binary or an HTML file named `.apk` was accepted and published into
 * the catalog (security review S-2). Devices refuse to install such a thing, so
 * it was never remote code execution — it was an integrity failure in a
 * distribution system, which is the one property a store exists to provide.
 *
 * Two checks, in increasing cost:
 *
 *   1. the ZIP magic number, which both APK and IPA must carry;
 *   2. a required entry name, read out of the archive's central directory,
 *      which distinguishes an APK from an IPA from a zip of holiday photos.
 *
 * Deliberately dependency-free, and deliberately not a zip *parser*: it locates
 * the central directory and searches it as bytes. Nothing here decompresses,
 * follows a path, or allocates based on an entry's claimed size, so the classic
 * archive attacks — zip bombs, path traversal — have no surface to land on.
 */

/** `PK\x03\x04` — the local file header every zip starts with. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/** `PK\x05\x06` — End Of Central Directory. */
const EOCD_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06])

/**
 * A zip comment is a 16-bit length, so the EOCD begins at most 65535 + 22 bytes
 * from the end. Searching that window always finds it if it is there.
 */
const EOCD_SEARCH_BYTES = 65535 + 22

/**
 * Ceiling on how much central directory to read.
 *
 * A real APK's central directory is a few hundred KB; this is generous. It
 * exists because the size below is a number the FILE supplies, and reading
 * whatever an upload claims is how a validator becomes the denial of service.
 */
const MAX_CENTRAL_DIRECTORY_BYTES = 32 * 1024 * 1024

export type PackageKind = 'apk' | 'ipa'

/**
 * A name that must appear among the archive's entries.
 *
 * `AndroidManifest.xml` is mandatory in every APK. `Payload/` is the directory
 * every IPA nests its bundle under. Neither can be absent from a real package,
 * and neither appears in an arbitrary file that merely starts with `PK`.
 */
const REQUIRED_ENTRY: Record<PackageKind, string> = {
  apk: 'AndroidManifest.xml',
  ipa: 'Payload/',
}

export class InvalidPackageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPackageError'
  }
}

const readWindow = async (
  path: string,
  position: number,
  length: number,
): Promise<Buffer> => {
  if (length <= 0) return Buffer.alloc(0)
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, position)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

/** Byte range of the central directory, per the archive's own EOCD record. */
interface CentralDirectory {
  offset: number
  size: number
}

const findCentralDirectory = async (
  path: string,
  fileSize: number,
): Promise<CentralDirectory | null> => {
  const searchLength = Math.min(fileSize, EOCD_SEARCH_BYTES)
  const tail = await readWindow(path, fileSize - searchLength, searchLength)

  // Last occurrence: a comment could itself contain the signature, and the real
  // record is always the final one.
  const eocd = tail.lastIndexOf(EOCD_MAGIC)
  if (eocd === -1 || eocd + 20 > tail.length) return null

  const size = tail.readUInt32LE(eocd + 12)
  const offset = tail.readUInt32LE(eocd + 16)

  // 0xFFFFFFFF is the ZIP64 sentinel. The upload cap is 2 GiB so this cannot be
  // a legitimate package here; treat it as unreadable rather than guessing.
  if (size === 0xffffffff || offset === 0xffffffff) return null
  if (offset + size > fileSize) return null

  return { offset, size }
}

/**
 * Throws `InvalidPackageError` when the file is not a `kind` package.
 *
 * Called BEFORE the bytes reach the content-addressed store, so a rejected
 * upload leaves nothing behind to sweep up.
 */
export const assertValidPackage = async (
  path: string,
  kind: PackageKind,
): Promise<void> => {
  const head = await readWindow(path, 0, ZIP_MAGIC.length)

  if (!head.equals(ZIP_MAGIC)) {
    throw new InvalidPackageError(
      `File is not ${kind === 'apk' ? 'an APK' : 'an IPA'}: expected a zip ` +
        `archive, got ${head.length === 0 ? 'an empty file' : `bytes ${head.toString('hex')}`}`,
    )
  }

  const { size: fileSize } = await stat(path)
  const directory = await findCentralDirectory(path, fileSize)

  if (!directory) {
    throw new InvalidPackageError(
      'File starts like a zip archive but has no readable central directory ' +
        `(${fileSize} bytes) — it may be truncated`,
    )
  }

  const entries = await readWindow(
    path,
    directory.offset,
    Math.min(directory.size, MAX_CENTRAL_DIRECTORY_BYTES),
  )

  // Entry names are stored as raw bytes in the central directory, so a plain
  // substring search finds them without decoding a single entry.
  if (!entries.includes(REQUIRED_ENTRY[kind])) {
    throw new InvalidPackageError(
      `File is a zip archive but not ${kind === 'apk' ? 'an APK' : 'an IPA'}: ` +
        `no "${REQUIRED_ENTRY[kind]}" entry found`,
    )
  }
}

export const kindForExtension = (extension: string): PackageKind => {
  if (extension === '.apk') return 'apk'
  if (extension === '.ipa') return 'ipa'
  throw new InvalidPackageError('file must be a .apk or .ipa')
}
