/**
 * Seeds a working catalog so a fresh clone runs without the real binaries.
 *
 *   pnpm --filter @appstore/api seed
 *   pnpm --filter @appstore/api seed -- --org acme --email me@acme.test
 *
 * Creates the organization, an owner login, and a handful of apps with
 * published releases and placeholder artifacts. Everything the app needs to be
 * exercised end to end — catalog, search, detail, download ticket, signed
 * stream, version-check — works immediately.
 *
 * The artifacts are a few KB of filler, NOT installable packages. They exist so
 * the download path resolves; installing one will be refused by the OS, which
 * is correct. Use scripts/ingest-binaries.ts to load real APK/IPA files.
 *
 * Idempotent: re-running updates in place rather than duplicating.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import argon2 from 'argon2'
import postgres from 'postgres'

const storeRoot = (): string =>
  process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

interface SeedRelease {
  platform: 'android' | 'ios'
  version: string
  minOs: string
  packageId: string
  /** Roughly how large the placeholder should be, for believable UI. */
  sizeKb: number
}

interface SeedApp {
  slug: string
  name: string
  tagline: string
  description: string
  category: string
  publisher: string
  featured: boolean
  /** Oldest build still allowed to run; '' means never force. */
  minimumVersion: string
  releases: SeedRelease[]
}

const CATALOG: SeedApp[] = [
  {
    slug: 'hr-portal',
    name: 'HR Portal',
    tagline: 'Leave, payslips, and org chart in one place',
    description:
      'Request leave, download payslips, and browse the org chart. Single sign-on with your company account.',
    category: 'HR',
    publisher: 'People Ops Engineering',
    featured: true,
    minimumVersion: '3.0.0',
    releases: [
      { platform: 'android', version: '3.2.1', minOs: 'API 28', packageId: 'com.internal.hrportal', sizeKb: 42 },
      { platform: 'ios', version: '3.2.0', minOs: 'iOS 16.0', packageId: 'com.internal.hrportal', sizeKb: 55 },
    ],
  },
  {
    slug: 'expense-tracker',
    name: 'Expense Tracker',
    tagline: 'Snap a receipt, get reimbursed',
    description:
      'Photograph a receipt and submit it for approval. Tracks reimbursement status end to end.',
    category: 'Finance',
    publisher: 'Finance Systems',
    featured: false,
    minimumVersion: '',
    releases: [
      { platform: 'android', version: '1.4.0', minOs: 'API 26', packageId: 'com.internal.expenses', sizeKb: 29 },
    ],
  },
  {
    slug: 'field-scanner',
    name: 'Field Scanner',
    tagline: 'Barcode and asset scanning for site teams',
    description:
      'Offline-capable barcode scanning for asset audits. Syncs when the device regains connectivity.',
    category: 'Tools',
    publisher: 'Platform Team',
    featured: true,
    minimumVersion: '',
    releases: [
      { platform: 'android', version: '2.1.0', minOs: 'API 29', packageId: 'com.internal.fieldscanner', sizeKb: 61 },
      { platform: 'ios', version: '2.1.0', minOs: 'iOS 15.0', packageId: 'com.internal.fieldscanner', sizeKb: 70 },
    ],
  },
  {
    slug: 'shift-planner',
    name: 'Shift Planner',
    tagline: 'Rosters, swaps, and clock-in',
    description: 'View your roster, request swaps, and clock in from the site.',
    category: 'Ops',
    publisher: 'Workforce Tools',
    featured: false,
    minimumVersion: '',
    releases: [
      { platform: 'ios', version: '2.7.4', minOs: 'iOS 16.1', packageId: 'com.internal.shiftplanner', sizeKb: 33 },
    ],
  },
]

const arg = (flag: string, fallback: string): string => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

/** Deterministic filler so re-running produces the same digests. */
const placeholder = (seed: string, sizeKb: number): Buffer => {
  const block = createHash('sha256').update(seed).digest()
  return Buffer.concat(Array.from({ length: Math.ceil((sizeKb * 1024) / block.length) }, () => block))
    .subarray(0, sizeKb * 1024)
}

const main = async (): Promise<void> => {
  const orgSlug = arg('--org', 'maya')
  const email = arg('--email', 'demo@maya.app')
  const password = arg('--password', 'demo1234')

  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('set MIGRATION_DATABASE_URL or DATABASE_URL')

  const sql = postgres(url, { max: 1 })

  try {
    const [org] = await sql<{ id: string }[]>`
      insert into organizations (slug, name)
      values (${orgSlug}, ${orgSlug.toUpperCase()})
      on conflict (slug) do update set name = excluded.name
      returning id
    `
    const orgId = org!.id

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, display_name)
      values (${email}, ${passwordHash}, ${email.split('@')[0]})
      on conflict (email) do update set password_hash = excluded.password_hash
      returning id
    `

    // Every tenant table is RLS-FORCEd even for the schema owner.
    await sql.unsafe(`set app.current_org_id = '${orgId}'`)

    await sql`
      insert into memberships (org_id, user_id, role)
      values (${orgId}, ${user!.id}, 'owner')
      on conflict (org_id, user_id) do update set role = 'owner'
    `

    let apps = 0
    let releases = 0

    for (const app of CATALOG) {
      const platforms = new Set(app.releases.map((r) => r.platform))
      const platform = platforms.size > 1 ? 'both' : [...platforms][0]!

      const [row] = await sql<{ id: string }[]>`
        insert into apps (org_id, slug, name, description, category, platform,
                          tagline, publisher, featured, minimum_version,
                          screenshot_urls, created_by)
        values (${orgId}, ${app.slug}, ${app.name}, ${app.description},
                ${app.category}, ${platform}::app_platform, ${app.tagline},
                ${app.publisher}, ${app.featured}, ${app.minimumVersion},
                ${[1, 2, 3].map((n) => `mock://${app.slug}/screenshot-${n}`)},
                ${user!.id})
        on conflict (org_id, slug) do update set
          name = excluded.name, description = excluded.description,
          category = excluded.category, platform = excluded.platform,
          tagline = excluded.tagline, publisher = excluded.publisher,
          featured = excluded.featured, minimum_version = excluded.minimum_version,
          screenshot_urls = excluded.screenshot_urls, updated_at = now()
        returning id
      `
      apps += 1

      for (const release of app.releases) {
        const bytes = placeholder(`${app.slug}-${release.platform}-${release.version}`, release.sizeKb)
        const sha256 = createHash('sha256').update(bytes).digest('hex')
        const extension = release.platform === 'android' ? '.apk' : '.ipa'
        const storageKey = path.join(orgId, sha256.slice(0, 2), `${sha256}${extension}`)
        const destination = path.join(storeRoot(), storageKey)

        await fs.mkdir(path.dirname(destination), { recursive: true })
        await fs.writeFile(destination, bytes)

        const existing = await sql<{ id: string }[]>`
          select id from releases
          where app_id = ${row!.id} and platform = ${release.platform}::app_platform
            and version = ${release.version}
        `

        const releaseId =
          existing[0]?.id ??
          (
            await sql<{ id: string }[]>`
              insert into releases (org_id, app_id, platform, version, min_os,
                                    release_notes, status, published_at, created_by)
              values (${orgId}, ${row!.id}, ${release.platform}::app_platform,
                      ${release.version}, ${release.minOs},
                      ${`Seeded build of ${app.name} ${release.version}.`},
                      'published', now(), ${user!.id})
              returning id
            `
          )[0]!.id

        if (!existing[0]) releases += 1

        await sql`
          insert into artifacts (org_id, release_id, package_id, storage_key, sha256,
                                 size_bytes, content_type, original_filename)
          values (${orgId}, ${releaseId}, ${release.packageId}, ${storageKey}, ${sha256},
                  ${bytes.length},
                  ${release.platform === 'android'
                      ? 'application/vnd.android.package-archive'
                      : 'application/octet-stream'},
                  ${`${app.slug}-${release.version}${extension}`})
          on conflict (org_id, sha256) do nothing
        `
      }
    }

    console.log(`org       ${orgSlug} (${orgId})`)
    console.log(`login     ${email} / ${password}`)
    console.log(`catalog   ${apps} apps, ${releases} new releases`)
    console.log(`store     ${storeRoot()}`)
    console.log('\nPlaceholder artifacts — the download path works, but they are')
    console.log('not installable packages. Use `pnpm ingest` for real APK/IPA files.')
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
