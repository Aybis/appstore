/**
 * Publishes a MAYA client build to the download portal.
 *
 *   pnpm --filter @appstore/api publish:client <apk-path-or-url>
 *
 * The portal serves the client from `store/client/`, which is gitignored
 * because a 100 MB binary does not belong in a repository. That is the right
 * call, but it means a fresh deployment starts with no build and the steps to
 * produce one — download, hash, read the manifest attributes, write JSON — are
 * exactly the kind of thing that gets done by hand once and then done wrong
 * six weeks later. This script is that procedure, so the next release is one
 * command rather than a memory test.
 *
 * The digest is computed from the bytes that landed on disk, never taken on
 * trust, because the API refuses to serve a build whose bytes disagree with
 * its manifest — a manifest written from a guessed digest would take the
 * portal down rather than mis-serve, but it would still take it down.
 *
 * Attributes (version, package, minSdk, ABIs, signer) come from aapt2 and
 * apksigner in the Android SDK build-tools. Without them the script stops
 * instead of inventing values: a portal that states the wrong minimum Android
 * version sends people to an install that fails on their device.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const storeRoot = (): string =>
  process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

const clientRoot = (): string => path.join(storeRoot(), 'client')

/** Android API level to the version name a person recognises. */
const ANDROID_NAMES: Record<number, string> = {
  21: 'Android 5.0', 22: 'Android 5.1', 23: 'Android 6.0', 24: 'Android 7.0',
  25: 'Android 7.1', 26: 'Android 8.0', 27: 'Android 8.1', 28: 'Android 9',
  29: 'Android 10', 30: 'Android 11', 31: 'Android 12', 32: 'Android 12L',
  33: 'Android 13', 34: 'Android 14', 35: 'Android 15', 36: 'Android 16',
}

const findBuildTool = async (name: string): Promise<string> => {
  const home =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    path.join(os.homedir(), 'Library/Android/sdk')

  const versions = await fs.readdir(path.join(home, 'build-tools')).catch(() => [])
  // Highest version first — the newest installed build-tools is the safest bet
  // for reading an APK built against a recent target SDK.
  for (const version of versions.sort().reverse()) {
    const candidate = path.join(home, 'build-tools', version, name)
    if (await fs.stat(candidate).then(() => true).catch(() => false)) return candidate
  }
  throw new Error(
    `Could not find ${name}. Install the Android SDK build-tools, or set ANDROID_HOME.`,
  )
}

const digestOf = async (file: string): Promise<string> => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

const main = async (): Promise<void> => {
  const source = process.argv[2]
  if (!source) {
    console.error('Usage: publish:client <apk-path-or-url>')
    process.exitCode = 1
    return
  }

  const androidDir = path.join(clientRoot(), 'android')
  await fs.mkdir(androidDir, { recursive: true })

  // Staged under a temp name first: writing straight to the final path would
  // leave a half-downloaded APK where the manifest says a complete one is, and
  // the API would serve it until somebody noticed the digest failure.
  const staged = path.join(androidDir, `.staging-${process.pid}.apk`)

  try {
    if (/^https?:\/\//.test(source)) {
      console.log(`Downloading ${source}`)
      const response = await fetch(source)
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      await fs.writeFile(staged, Buffer.from(await response.arrayBuffer()))
    } else {
      await fs.copyFile(path.resolve(source), staged)
    }

    const aapt2 = await findBuildTool('aapt2')
    const apksigner = await findBuildTool('apksigner')

    const badging = execFileSync(aapt2, ['dump', 'badging', staged], { encoding: 'utf8' })
    const tree = execFileSync(
      aapt2,
      ['dump', 'xmltree', staged, '--file', 'AndroidManifest.xml'],
      { encoding: 'utf8' },
    )
    const certs = execFileSync(apksigner, ['verify', '--print-certs', staged], {
      encoding: 'utf8',
    })

    const pick = (pattern: RegExp, from: string, label: string): string => {
      const match = pattern.exec(from)
      if (!match?.[1]) throw new Error(`Could not read ${label} from the APK`)
      return match[1]
    }

    const version = pick(/versionName='([^']+)'/, badging, 'versionName')
    const versionCode = Number(pick(/versionCode='(\d+)'/, badging, 'versionCode'))
    const packageId = pick(/package: name='([^']+)'/, badging, 'package name')
    const minSdk = Number(pick(/minSdkVersion\(0x[0-9a-f]+\)=(\d+)/, tree, 'minSdkVersion'))
    const signerSha256 = pick(
      /Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/,
      certs,
      'signer certificate',
    ).toLowerCase()

    const abis = [...badging.matchAll(/native-code: (.+)/g)]
      .flatMap((match) => [...(match[1] ?? '').matchAll(/'([^']+)'/g)].map((abi) => abi[1]!))

    const [sha256, stat] = await Promise.all([digestOf(staged), fs.stat(staged)])

    const filename = `maya-${version}.apk`
    await fs.rename(staged, path.join(androidDir, filename))

    const existing = await fs
      .readFile(path.join(clientRoot(), 'manifest.json'), 'utf8')
      .then((raw) => JSON.parse(raw) as Record<string, unknown>)
      .catch(() => ({}))

    const manifest = {
      ...existing,
      android: {
        version,
        versionCode,
        file: `android/${filename}`,
        sha256,
        sizeBytes: stat.size,
        packageId,
        minSdk,
        minOsLabel: ANDROID_NAMES[minSdk] ?? `API level ${minSdk}`,
        abis,
        signerSha256,
        releasedAt: new Date().toISOString(),
        source,
      },
    }

    await fs.writeFile(
      path.join(clientRoot(), 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )

    /*
     * Older client builds are NOT deleted, and they are not swept either:
     * prune-store.ts treats `client/` as a reserved prefix precisely so it
     * cannot delete the binary the portal serves. That is the right default,
     * but it means superseded builds accumulate invisibly — so they are named
     * here, and removing one stays a decision somebody makes rather than a
     * side effect of publishing. Keeping the previous build is what makes a
     * rollback a file rename instead of a rebuild.
     */
    const superseded = (await fs.readdir(androidDir))
      .filter((entry) => entry.endsWith('.apk') && entry !== filename)

    console.log(`Published MAYA ${version} (build ${versionCode})`)
    console.log(`  ${(stat.size / 1_000_000).toFixed(0)} MB · ${abis.join(', ')}`)
    console.log(`  min ${ANDROID_NAMES[minSdk] ?? minSdk} · ${packageId}`)
    console.log(`  sha256   ${sha256}`)
    console.log(`  signer   ${signerSha256}`)
    console.log('')
    console.log('The signer digest above is what assetlinks.json must contain for')
    console.log('Android App Links to open this build instead of the website.')

    if (superseded.length > 0) {
      console.log('')
      console.log(`Superseded and still on disk (kept, so a rollback is a rename):`)
      for (const entry of superseded) {
        const { size } = await fs.stat(path.join(androidDir, entry))
        console.log(`  ${entry}  ${(size / 1_000_000).toFixed(0)} MB`)
      }
    }
  } finally {
    await fs.rm(staged, { force: true })
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
