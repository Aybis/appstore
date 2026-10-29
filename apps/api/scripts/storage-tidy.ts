/**
 * Puts the file store in line with the database: one file per build, in the
 * readable layout, and nothing that no row points at.
 *
 *   pnpm --filter @appstore/api storage:tidy             # report only
 *   pnpm --filter @appstore/api storage:tidy -- --apply  # do it
 *
 * Works on whichever store and database the env names: BLOB_STORE=s3 and the
 * S3_* values for R2, MIGRATION_DATABASE_URL for the database. Run it with the
 * PRODUCTION values to tidy the production bucket.
 *
 * What --apply does, in order:
 *   1. Moves every build to <org>/<app>/<platform>/<app>-<version>-<sha8>.<ext>
 *      (see artifactKey) and updates artifacts.storage_key to match. Releases
 *      that share identical bytes end up sharing one file.
 *   2. Repoints the MAYA client manifest at the release file it was copied
 *      from, so the copy under client/ is no longer needed.
 *   3. Deletes every object nothing references: old locations, the client
 *      copy, and folders left by test runs or failed uploads.
 *
 * Files the database points at but the store lacks are listed: those
 * downloads are broken. When MOST are missing, step 3 refuses to run — that is
 * the signature of pointing at the wrong database (or bucket), and deleting
 * "orphans" then would empty a bucket that belongs to another one.
 */
import '../src/config/load-env'
import { migrationUrl } from '../src/config/migration-url'
import path from 'node:path'
import postgres from 'postgres'

import { artifactKey } from '../src/modules/storage/artifact-store'
import { blobStore } from '../src/modules/storage/blob-store'

type Row = {
  id: string
  storage_key: string
  sha256: string
  platform: string
  version: string
  app_slug: string
  original_filename: string
}

type ManifestEntry = { sha256: string; storageKey?: string; file?: string } & Record<string, unknown>

const MANIFEST = 'client/manifest.json'

const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`

const readManifest = async (): Promise<Record<string, ManifestEntry | null> | null> => {
  const object = await blobStore().get(MANIFEST)
  if (!object) return null
  const chunks: Buffer[] = []
  for await (const chunk of object.body) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, ManifestEntry | null>
}

const main = async (): Promise<void> => {
  const apply = process.argv.includes('--apply')
  const url = migrationUrl()

  const store = blobStore()
  const sql = postgres(url, { max: 1 })
  const referenced = new Set<string>([MANIFEST])
  const bySha = new Map<string, string>()
  let moved = 0

  try {
    const orgs = await sql<{ id: string; slug: string }[]>`select id, slug from organizations order by slug`

    for (const org of orgs) {
      // artifacts and apps are RLS-FORCEd even for the owner, so each org's
      // rows are only visible with its id bound. Skipping this would see no
      // rows at all — and call every file an orphan.
      await sql.unsafe(`set app.current_org_id = '${org.id}'`)

      const icons = await sql<{ icon_key: string }[]>`select icon_key from apps where icon_key <> ''`
      for (const icon of icons) referenced.add(`icons/${icon.icon_key}`)

      const rows = await sql<Row[]>`
        select a.id, a.storage_key, a.sha256, r.platform::text as platform, r.version,
               ap.slug as app_slug, a.original_filename
        from artifacts a
        join releases r on r.id = a.release_id
        join apps ap on ap.id = r.app_id
        order by r.created_at
      `

      // One file per distinct build: the earliest release carrying the bytes
      // names it, and every other release with the same bytes shares it.
      const groups = new Map<string, Row[]>()
      for (const row of rows) groups.set(row.sha256, [...(groups.get(row.sha256) ?? []), row])

      for (const [sha256, group] of groups) {
        const first = group[0]!
        const extension = path.extname(first.storage_key) || path.extname(first.original_filename)
        const target = artifactKey({
          orgSlug: org.slug,
          appSlug: first.app_slug,
          platform: first.platform,
          version: first.version,
          sha256,
          extension,
        })
        bySha.set(sha256, target)

        const stale = group.filter((row) => row.storage_key !== target)
        if (stale.length === 0 || apply) referenced.add(target)
        if (stale.length === 0) continue

        console.log(`  ${apply ? 'move' : 'would move'}  ${stale[0]!.storage_key}\n          → ${target}`)
        moved += 1
        if (!apply) {
          // Until it moves, each row's current file is still what it needs.
          for (const row of group) referenced.add(row.storage_key)
          continue
        }

        if ((await store.size(target)) === null) {
          const source = (
            await Promise.all(group.map(async (row) => ((await store.size(row.storage_key)) !== null ? row.storage_key : null)))
          ).find(Boolean)
          if (!source) {
            console.warn(`  ! no file found for ${first.app_slug} ${first.version} (${sha256.slice(0, 8)})`)
            continue
          }
          await store.copy(source, target)
        }
        // Only storage_key changes; migration 0016 allows exactly that.
        await sql`update artifacts set storage_key = ${target} where id = any(${stale.map((row) => row.id)}::uuid[])`
      }
    }
  } finally {
    await sql.end()
  }

  // The MAYA client: point at the release file instead of a copy under client/.
  const manifest = await readManifest()
  for (const [platform, entry] of Object.entries(manifest ?? {})) {
    if (!entry) continue
    const releaseKey = bySha.get(entry.sha256)
    if (releaseKey && entry.storageKey !== releaseKey) {
      console.log(`  ${apply ? 'repoint' : 'would repoint'}  client ${platform} → ${releaseKey}`)
      entry.storageKey = releaseKey
      delete entry.file
    }
    if (entry.storageKey) referenced.add(entry.storageKey)
    else if (entry.file) {
      referenced.add(path.posix.join('client', entry.file))
      console.warn(
        `  ! client ${platform} is not a release in the catalog. Upload it as a release of the MAYA app ` +
          'and use "Publish as MAYA app" in the console, then run this again.',
      )
    }
  }
  if (apply && manifest) {
    await store.putBuffer(MANIFEST, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), 'application/json')
  }

  const objects = await store.list()
  const present = new Set(objects.map((object) => object.key))
  const missing = [...referenced].filter((key) => key !== MANIFEST && !present.has(key))
  const orphans = objects.filter((object) => !referenced.has(object.key))
  const reclaimable = orphans.reduce((total, object) => total + object.sizeBytes, 0)

  console.log(`\nstore        ${process.env.BLOB_STORE === 's3' ? `s3://${process.env.S3_BUCKET}` : 'local disk'}`)
  console.log(`objects      ${objects.length}`)
  console.log(`referenced   ${referenced.size - 1} (+ client manifest)`)
  console.log(`${apply ? 'moved' : 'to move'}      ${moved}`)
  console.log(`orphaned     ${orphans.length} (${formatBytes(reclaimable)})`)
  for (const orphan of orphans.slice(0, 30)) {
    console.log(`  ${apply ? '-' : '?'} ${orphan.key}  ${formatBytes(orphan.sizeBytes)}`)
  }
  if (orphans.length > 30) console.log(`  … and ${orphans.length - 30} more`)

  if (missing.length > 0) {
    console.warn(`\nmissing      ${missing.length} file(s) the database points at — those downloads fail:`)
    for (const key of missing.slice(0, 30)) console.warn(`  ! ${key}`)
  }

  // Most of what the database needs is absent — or it needs nothing at all
  // while the store is full: this database and this store do not belong
  // together (a local DB against the production bucket, an empty schema, a
  // tenant binding that did not take). Every file would look like an orphan,
  // so delete nothing.
  const needed = referenced.size - 1
  const builds = [...referenced].filter((key) => key !== MANIFEST && !key.startsWith('icons/')).length
  if ((missing.length > 0 && missing.length * 2 >= needed) || (builds === 0 && objects.length > 0)) {
    console.error('\nThe database and the store do not belong together — check the env. Nothing deleted.')
    process.exitCode = 1
    return
  }

  if (!apply) {
    console.log('\nnothing changed — re-run with --apply to do it')
    return
  }

  for (const orphan of orphans) await store.delete(orphan.key)
  console.log(`\ndeleted ${orphans.length} objects, reclaimed ${formatBytes(reclaimable)}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
