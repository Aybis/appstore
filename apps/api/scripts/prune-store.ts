/**
 * Removes artifact objects the database no longer references.
 *
 *   pnpm --filter @appstore/api prune            # report only
 *   pnpm --filter @appstore/api prune -- --delete
 *
 * The store is append-only by design: uploads write, downloads read, and
 * nothing ever removes. That is correct while a release exists — a published
 * release is immutable and devices may fetch it at any time — but it means
 * deleting an app cascades its rows and strands the bytes forever.
 *
 * Orphans are found by difference, never by age: an object is only removed when
 * no `artifacts` row in any org names it. A recently uploaded object whose row
 * exists is safe by construction, so there is no race window to tune.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import postgres from 'postgres'

const storeRoot = (): string =>
  process.env.ARTIFACT_STORE ?? path.resolve(process.cwd(), '../../store')

/** Every file under the store, as store-relative keys. */
const walk = async (root: string, prefix = ''): Promise<string[]> => {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true })
  const found: string[] = []

  for (const entry of entries) {
    const rel = path.join(prefix, entry.name)
    if (entry.isDirectory()) found.push(...(await walk(root, rel)))
    else if (entry.isFile()) found.push(rel)
  }
  return found
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`

/**
 * Paths under the store that no `artifacts` row will ever reference.
 *
 * `client/` holds the MAYA client build the download portal serves — a deploy
 * artifact rather than catalog content, so it is deliberately absent from the
 * database. This sweep deletes whatever the database does not name, which
 * without this guard meant it reported the 107 MB client APK and its manifest
 * as orphans and `--delete` would have removed them. The portal would then
 * have served "No build published yet" with nothing in the logs to explain it.
 */
const RESERVED_PREFIXES = ['client/']

const isReserved = (key: string): boolean =>
  RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))

const main = async (): Promise<void> => {
  const remove = process.argv.includes('--delete')
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('set MIGRATION_DATABASE_URL or DATABASE_URL')

  const root = storeRoot()
  const onDisk = await walk(root).catch(() => [])
  if (onDisk.length === 0) {
    console.log(`store is empty: ${root}`)
    return
  }

  const sql = postgres(url, { max: 1 })
  const referenced = new Set<string>()

  try {
    const orgs = await sql<{ id: string }[]>`select id from organizations`

    // artifacts is RLS-FORCEd even for the owner, so each org's rows are only
    // visible with its GUC bound. Missing this would report every object as an
    // orphan — and with --delete, empty the store.
    for (const org of orgs) {
      await sql.unsafe(`set app.current_org_id = '${org.id}'`)
      const rows = await sql<{ storage_key: string }[]>`
        select storage_key from artifacts
      `
      for (const row of rows) referenced.add(row.storage_key)
    }
  } finally {
    await sql.end()
  }

  const orphans: { key: string; size: number }[] = []
  for (const key of onDisk) {
    if (referenced.has(key)) continue
    if (isReserved(key)) continue
    const stat = await fs.stat(path.join(root, key))
    orphans.push({ key, size: stat.size })
  }

  const reclaimable = orphans.reduce((total, o) => total + o.size, 0)

  console.log(`store        ${root}`)
  console.log(`objects      ${onDisk.length}`)
  console.log(`referenced   ${referenced.size}`)
  console.log(`orphaned     ${orphans.length} (${formatBytes(reclaimable)})`)

  if (orphans.length === 0) {
    await sweepSpool(remove)
    return
  }

  for (const orphan of orphans.slice(0, 20)) {
    console.log(`  ${remove ? '-' : '?'} ${orphan.key}  ${formatBytes(orphan.size)}`)
  }
  if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`)

  if (!remove) {
    console.log('\nnothing deleted — re-run with --delete to reclaim')
    await sweepSpool(remove)
    return
  }

  for (const orphan of orphans) {
    await fs.rm(path.join(root, orphan.key), { force: true })
  }
  // Leave no empty shard directories behind.
  for (const dir of new Set(orphans.map((o) => path.dirname(o.key)))) {
    await fs.rmdir(path.join(root, dir)).catch(() => undefined)
  }
  console.log(`\ndeleted ${orphans.length} objects, reclaimed ${formatBytes(reclaimable)}`)
  await sweepSpool(remove)
}

/**
 * Sweeps multer's spool directory.
 *
 * SpoolCleanupInterceptor removes the file however a request ends, so nothing
 * new should land here — but a process killed mid-upload never runs a
 * `finalize`, and those bytes have nobody left to delete them. Age is the only
 * safe signal: a file being written right now looks exactly like one abandoned
 * an hour ago, so anything younger than the cutoff is left alone.
 */
const sweepSpool = async (remove: boolean): Promise<void> => {
  const spool = process.env.UPLOAD_TMP ?? path.join(os.tmpdir(), 'maya-uploads')
  const names = await fs.readdir(spool).catch(() => null)
  if (!names) return

  const cutoff = Date.now() - SPOOL_MAX_AGE_MS
  const stale: { name: string; size: number }[] = []

  for (const name of names) {
    const stat = await fs.stat(path.join(spool, name)).catch(() => null)
    if (!stat?.isFile()) continue
    if (stat.mtimeMs > cutoff) continue
    stale.push({ name, size: stat.size })
  }

  const reclaimable = stale.reduce((total, entry) => total + entry.size, 0)
  console.log(`\nspool        ${spool}`)
  console.log(`abandoned    ${stale.length} (${formatBytes(reclaimable)})`)

  if (stale.length === 0 || !remove) return

  for (const entry of stale) {
    await fs.rm(path.join(spool, entry.name), { force: true })
  }
  console.log(`deleted ${stale.length} spool files, reclaimed ${formatBytes(reclaimable)}`)
}

/** An upload that has not been touched in this long is not still running. */
const SPOOL_MAX_AGE_MS = 6 * 60 * 60 * 1000

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
