/**
 * Ingests .apk / .ipa files from a directory into the catalog.
 *
 *   pnpm --filter @appstore/api ingest -- <dir> [--org acme]
 *
 * For each binary it extracts real metadata (aapt2 for Android, Info.plist for
 * iOS), copies the file into the content-addressed store keyed by SHA-256, and
 * writes app + release + artifact rows.
 *
 * Re-runnable: apps and releases are matched on their natural keys and
 * artifacts on (org, sha256), so ingesting the same folder twice is a no-op.
 *
 * Runs as the schema owner, but RLS is FORCEd on every tenant table — the owner
 * is subject to policy too — so the org GUC is set for the whole transaction.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

type Platform = 'android' | 'ios'

interface Extracted {
  platform: Platform
  packageId: string
  name: string
  version: string
  buildNumber: string | null
  minOs: string
  file: string
  sizeBytes: number
  sha256: string
  contentType: string
}

const STORE_ROOT = process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

const CATEGORY_BY_SLUG: Record<string, string> = {
  instagram: 'Social',
  facebook: 'Social',
  pinterest: 'Social',
  telegram: 'Social',
  spotify: 'Media',
  netflix: 'Media',
  'yt-kids': 'Kids',
  adventure: 'Kids',
  'cooking-game': 'Kids',
  'building-car-games-for-kids': 'Kids',
  canva: 'Productivity',
  calculator: 'Tools',
  'google-maps': 'Navigation',
}

const TAGLINE_BY_SLUG: Record<string, string> = {
  instagram: 'Photos, reels and stories',
  facebook: 'Stay connected with your people',
  pinterest: 'Find ideas worth keeping',
  telegram: 'Fast, secure messaging',
  spotify: 'Music and podcasts, everywhere',
  netflix: 'Films and series on demand',
  'yt-kids': 'A safer video app for children',
  canva: 'Design anything, right from your phone',
  calculator: 'Simple and scientific calculation',
  'google-maps': 'Navigation, transit and local search',
}

/** Marked so the catalog's Featured rail has something to show. */
const FEATURED = new Set(['spotify', 'canva', 'google-maps'])

/**
 * Falls back to the reverse-DNS package id when the publisher is not known:
 * com.spotify.client -> Spotify. Wrong for vanity ids (com.burbn.instagram),
 * which is why the explicit map wins where it has an entry.
 */
const PUBLISHER_BY_SLUG: Record<string, string> = {
  instagram: 'Meta',
  facebook: 'Meta',
  'yt-kids': 'Google',
  'google-maps': 'Google',
  calculator: 'Google',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
  netflix: 'Netflix',
  telegram: 'Telegram FZ-LLC',
  canva: 'Canva',
}

const publisherFor = (slug: string, packageId: string): string => {
  const known = PUBLISHER_BY_SLUG[slug]
  if (known) return known
  const segment = packageId.split('.')[1] ?? packageId
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

/**
 * The store holds binaries, not media. `mock://` keeps the mobile Screenshot
 * component on its offline placeholder path (it only renders an <Image> for
 * http URLs), so the carousel reads correctly without inventing artwork.
 */
const placeholderScreenshots = (slug: string): string[] =>
  [1, 2, 3].map((n) => `mock://${slug}/screenshot-${n}`)

const sh = (cmd: string, args: string[]): string => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  } catch {
    return ''
  }
}

const aapt2 = (): string => {
  const base = path.join(process.env.HOME ?? '', 'Library/Android/sdk/build-tools')
  const versions = fs.existsSync(base) ? fs.readdirSync(base).sort() : []
  for (const v of versions.reverse()) {
    const candidate = path.join(base, v, 'aapt2')
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('aapt2 not found — install Android build-tools')
}

const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)

const digestOf = (file: string): string =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex')

const extractApk = (file: string, tool: string): Extracted | null => {
  const badging = sh(tool, ['dump', 'badging', file])
  if (!badging) return null

  const pick = (re: RegExp): string => badging.match(re)?.[1] ?? ''
  const label = pick(/^application-label:'([^']*)'/m)
  const name = label || path.basename(file).split('_')[0]

  return {
    platform: 'android',
    packageId: pick(/package: name='([^']*)'/),
    name,
    version: pick(/versionName='([^']*)'/) || '0',
    buildNumber: pick(/versionCode='([^']*)'/) || null,
    minOs: `API ${pick(/minSdkVersion:'([^']*)'/) || '?'}`,
    file,
    sizeBytes: fs.statSync(file).size,
    sha256: digestOf(file),
    contentType: 'application/vnd.android.package-archive',
  }
}

const extractIpa = (file: string): Extracted | null => {
  const listing = sh('unzip', ['-Z1', file])
  const plistPath = listing
    .split('\n')
    .find((entry) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(entry))
  if (!plistPath) return null

  const raw = execFileSync('sh', [
    '-c',
    `unzip -p ${JSON.stringify(file)} ${JSON.stringify(plistPath)} | plutil -convert json -o - -`,
  ])
  const plist = JSON.parse(raw.toString()) as Record<string, string>

  return {
    platform: 'ios',
    packageId: plist.CFBundleIdentifier ?? '',
    name:
      plist.CFBundleDisplayName ||
      plist.CFBundleName ||
      path.basename(file, '.ipa'),
    version: plist.CFBundleShortVersionString || '0',
    buildNumber: plist.CFBundleVersion ?? null,
    minOs: `iOS ${plist.MinimumOSVersion ?? '?'}`,
    file,
    sizeBytes: fs.statSync(file).size,
    sha256: digestOf(file),
    contentType: 'application/octet-stream',
  }
}

/** Copies into store/<org>/<aa>/<sha256><ext>, preferring an APFS clone. */
const storeArtifact = (orgId: string, item: Extracted): string => {
  const ext = path.extname(item.file).toLowerCase()
  const key = path.join(orgId, item.sha256.slice(0, 2), `${item.sha256}${ext}`)
  const dest = path.join(STORE_ROOT, key)

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    // -c is copy-on-write on APFS: instant, and costs no extra disk until one
    // side is modified. Artifacts are immutable, so it never diverges.
    try {
      execFileSync('cp', ['-c', item.file, dest])
    } catch {
      fs.copyFileSync(item.file, dest)
    }
  }
  return key
}

const main = async (): Promise<void> => {
  const dir = process.argv[2]
  if (!dir) throw new Error('usage: ingest-binaries <dir> [--org <slug>]')
  const orgSlug = process.argv.includes('--org')
    ? process.argv[process.argv.indexOf('--org') + 1]
    : 'maya'

  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('set MIGRATION_DATABASE_URL or DATABASE_URL')

  const tool = aapt2()
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(apk|ipa)$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort()

  console.log(`scanning ${files.length} binaries in ${dir}`)

  const items: Extracted[] = []
  for (const file of files) {
    const parsed = file.toLowerCase().endsWith('.apk')
      ? extractApk(file, tool)
      : extractIpa(file)
    if (!parsed || !parsed.packageId) {
      console.warn(`  ! skipped (no metadata): ${path.basename(file)}`)
      continue
    }
    items.push(parsed)
  }

  const sql = postgres(url, { max: 1 })

  try {
    const [org] = await sql<{ id: string }[]>`
      insert into organizations (slug, name)
      values (${orgSlug}, ${orgSlug.toUpperCase()})
      on conflict (slug) do update set name = excluded.name
      returning id
    `
    const orgId = org.id
    console.log(`org ${orgSlug} = ${orgId}`)

    // FORCE RLS applies to the owner too, so every statement below needs the
    // tenant GUC. Set once for the session since this script is single-tenant.
    await sql.unsafe(`set app.current_org_id = '${orgId}'`)

    let apps = 0
    let releases = 0
    let artifacts = 0

    for (const item of items) {
      const slug = slugify(item.name)
      const platformsForSlug = new Set(
        items.filter((other) => slugify(other.name) === slug).map((other) => other.platform),
      )
      const appPlatform = platformsForSlug.size > 1 ? 'both' : item.platform

      const [app] = await sql<{ id: string; inserted: boolean }[]>`
        insert into apps (org_id, slug, name, category, platform, tagline,
                          publisher, featured, screenshot_urls)
        values (${orgId}, ${slug}, ${item.name},
                ${CATEGORY_BY_SLUG[slug] ?? 'uncategorized'}, ${appPlatform},
                ${TAGLINE_BY_SLUG[slug] ?? ''},
                ${publisherFor(slug, item.packageId)},
                ${FEATURED.has(slug)},
                ${placeholderScreenshots(slug)})
        on conflict (org_id, slug) do update set
          platform = ${appPlatform},
          category = excluded.category,
          tagline = excluded.tagline,
          publisher = excluded.publisher,
          featured = excluded.featured,
          screenshot_urls = excluded.screenshot_urls,
          updated_at = now()
        returning id, (xmax = 0) as inserted
      `
      if (app.inserted) apps += 1

      const [release] = await sql<{ id: string; inserted: boolean }[]>`
        insert into releases (org_id, app_id, platform, version, build_number, min_os, status, published_at)
        values (${orgId}, ${app.id}, ${item.platform}, ${item.version}, ${item.buildNumber},
                ${item.minOs}, 'published', now())
        on conflict (app_id, platform, version) do update set min_os = excluded.min_os, updated_at = now()
        returning id, (xmax = 0) as inserted
      `
      if (release.inserted) releases += 1

      const storageKey = storeArtifact(orgId, item)

      const inserted = await sql<{ id: string }[]>`
        insert into artifacts (org_id, release_id, package_id, storage_key, sha256,
                               size_bytes, content_type, original_filename)
        values (${orgId}, ${release.id}, ${item.packageId}, ${storageKey}, ${item.sha256},
                ${item.sizeBytes}, ${item.contentType}, ${path.basename(item.file)})
        on conflict (org_id, sha256) do nothing
        returning id
      `
      if (inserted.length > 0) artifacts += 1

      console.log(
        `  + ${item.platform.padEnd(7)} ${item.name} ${item.version} (${(item.sizeBytes / 1048576).toFixed(1)} MB)`,
      )
    }

    console.log(`\n${apps} apps, ${releases} releases, ${artifacts} artifacts written`)
    console.log(`store: ${STORE_ROOT}`)
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
