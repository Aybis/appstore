import { deflateRawSync } from 'node:zlib'

/**
 * Builds a byte-valid zip carrying the entries a package validator looks for.
 *
 * The e2e suites used to upload `Buffer.from('PK pretend android package')`,
 * which was fine while upload validation was extension-only. Now that the
 * bytes are inspected, a fixture has to be a real archive — the alternative
 * would be weakening the validator to accommodate the tests, which defeats the
 * point of having it.
 *
 * `seed` varies the content so two fixtures produce different digests, which
 * matters wherever a test depends on artifacts being distinct.
 */
export const buildPackage = (
  entries: readonly string[],
  seed = 'maya',
): Buffer => {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const name of entries) {
    const nameBytes = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(Buffer.from(`${seed}:${name}`, 'utf8'))

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(seed.length + name.length + 1, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(seed.length + name.length + 1, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)

    offset += local.length + nameBytes.length + compressed.length
  }

  const localPart = Buffer.concat(locals)
  const centralPart = Buffer.concat(centrals)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)

  return Buffer.concat([localPart, centralPart, eocd])
}

/** A minimal but structurally valid Android package. */
export const buildApk = (seed = 'maya'): Buffer =>
  buildPackage(['AndroidManifest.xml', 'classes.dex', 'resources.arsc'], seed)

/** A minimal but structurally valid iOS package. */
export const buildIpa = (seed = 'maya'): Buffer =>
  buildPackage(['Payload/App.app/Info.plist', 'Payload/App.app/App'], seed)
