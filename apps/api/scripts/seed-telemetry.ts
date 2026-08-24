/**
 * Fills devices, install_events and app_ratings with demo activity.
 *
 *   pnpm --filter @appstore/api seed:telemetry -- --org maya
 *   pnpm --filter @appstore/api seed:telemetry -- --org maya --purge
 *
 * WHY THIS EXISTS RATHER THAN FAKE NUMBERS IN THE UI.
 *
 * The dashboard runs real queries. Nothing in it is a constant. So to see it
 * populated before real devices report, the rows have to be real rows — and
 * that is strictly better than a placeholder component, because the day actual
 * telemetry arrives NOTHING CHANGES: the same queries return the same shapes,
 * and there is no placeholder left behind to notice and remove.
 *
 * These rows are demo data and should not survive into a real deployment.
 * `--purge` deletes exactly what this writes: the three tables are empty
 * otherwise, so emptying them is unambiguous.
 */
import postgres from 'postgres'

const arg = (name: string, fallback = ''): string => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

/*
 * Deterministic, not random. A seed that produces different numbers on every
 * run makes "did that change because of my code?" unanswerable, and this data
 * exists to be looked at repeatedly.
 */
let state = 0x2f6e2b1
const next = (): number => {
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return Math.abs(state) / 0x7fffffff
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
const between = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1))

const ANDROID_MODELS = ['Pixel 8', 'Galaxy S23', 'Galaxy A54', 'Xperia 10 V', 'Galaxy Note 9']
const IOS_MODELS = ['iPhone 15', 'iPhone 14 Pro', 'iPhone SE', 'iPad Air']

const main = async (): Promise<void> => {
  const orgSlug = arg('--org', 'maya')
  const purge = process.argv.includes('--purge')

  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('set MIGRATION_DATABASE_URL or DATABASE_URL')

  const sql = postgres(url, { max: 1 })
  try {
    const [org] = await sql<{ id: string }[]>`select id from organizations where slug = ${orgSlug}`
    if (!org) throw new Error(`no organization with slug "${orgSlug}"`)

    /*
     * Every table this touches is FORCE row-secured, including for the owner,
     * so without binding the tenant the reads return nothing and the writes are
     * refused. Missing this reports "no members" for an org that plainly has
     * them — which is exactly what it did the first time.
     *
     * Interpolated rather than parameterised because SET does not take a bind
     * parameter; the value is a uuid straight out of the database, never input.
     */
    await sql.unsafe(`set app.current_org_id = '${org.id}'`)

    if (purge) {
      // install_events cascades from devices, but deleting explicitly says so.
      const events = await sql`delete from install_events where org_id = ${org.id} returning id`
      const ratings = await sql`delete from app_ratings where org_id = ${org.id} returning id`
      const devices = await sql`delete from devices where org_id = ${org.id} returning id`
      console.log(
        `purged ${devices.length} devices, ${events.length} install events, ${ratings.length} ratings`,
      )
      return
    }

    const members = await sql<{ id: string }[]>`
      select user_id as id from memberships where org_id = ${org.id}
    `
    if (members.length === 0) throw new Error('no members — seed members first')

    const apps = await sql<{ id: string; platform: string }[]>`
      select id, platform::text as platform from apps where org_id = ${org.id}
    `
    if (apps.length === 0) throw new Error('no apps — seed the catalog first')

    // Real releases, so version strings on the dashboard match real builds
    // rather than being invented alongside them.
    const releases = await sql<{ id: string; app_id: string; version: string }[]>`
      select id, app_id, version from releases where org_id = ${org.id}
    `
    const byApp = new Map<string, { id: string; version: string }[]>()
    for (const r of releases) {
      byApp.set(r.app_id, [...(byApp.get(r.app_id) ?? []), { id: r.id, version: r.version }])
    }

    // Two or three devices per person: a work phone, sometimes a tablet or a
    // second handset. One device per person would make "devices" a synonym for
    // "members" and the number would tell nobody anything.
    let deviceCount = 0
    let eventCount = 0

    for (const member of members) {
      for (let d = 0; d < between(1, 3); d += 1) {
        const platform = next() > 0.45 ? 'android' : 'ios'
        const model = platform === 'android' ? pick(ANDROID_MODELS) : pick(IOS_MODELS)
        const daysAgo = between(1, 120)

        const [device] = await sql<{ id: string }[]>`
          insert into devices (org_id, user_id, device_key, platform, model, os_version,
                               client_version, first_seen_at, last_seen_at)
          values (${org.id}, ${member.id}, ${`seed-${member.id.slice(0, 8)}-${d}`},
                  ${platform}::app_platform, ${model},
                  ${platform === 'android' ? `Android ${between(10, 15)}` : `iOS ${between(15, 18)}`},
                  ${next() > 0.3 ? '1.0.1' : '1.0.0'},
                  now() - make_interval(days => ${daysAgo}),
                  now() - make_interval(days => ${between(0, 6)}))
          on conflict (org_id, device_key) do update set last_seen_at = excluded.last_seen_at
          returning id
        `
        deviceCount += 1

        // Only apps this device could actually run. An iPhone with an
        // Android-only build installed would be a number that cannot happen.
        const installable = apps.filter(
          (app) => app.platform === 'both' || app.platform === platform,
        )

        for (const app of installable) {
          if (next() > 0.55) continue

          const candidates = byApp.get(app.id) ?? []
          const release = candidates.length > 0 ? pick(candidates) : null
          const version = release?.version ?? '1.0.0'
          // Most installs work. A minority fail, because a dashboard where
          // nothing ever fails teaches people to ignore the failure column.
          const outcome = next() > 0.92 ? 'failed' : next() > 0.7 ? 'updated' : 'installed'

          await sql`
            insert into install_events (org_id, device_id, app_id, release_id, version,
                                        outcome, created_at)
            values (${org.id}, ${device!.id}, ${app.id}, ${release?.id ?? null}, ${version},
                    ${outcome}::install_outcome,
                    now() - make_interval(days => ${between(0, Math.min(daysAgo, 60))}))
          `
          eventCount += 1
        }
      }
    }

    // Ratings on a subset — not every app gets rated, and pretending otherwise
    // would make the ratings table look busier than any real one ever is.
    let ratingCount = 0
    for (const app of apps) {
      if (next() > 0.6) continue
      for (const member of members) {
        if (next() > 0.5) continue
        const score = next() > 0.78 ? between(1, 2) : between(3, 5)
        await sql`
          insert into app_ratings (org_id, app_id, user_id, score, version, comment)
          values (${org.id}, ${app.id}, ${member.id}, ${score}, '1.0.0', '')
          on conflict (app_id, user_id) do nothing
        `
        ratingCount += 1
      }
    }

    console.log(`seeded ${deviceCount} devices, ${eventCount} install events, ${ratingCount} ratings`)
    console.log('')
    console.log('These are DEMO rows in real tables. The dashboard queries them for')
    console.log('real, so when actual devices report, nothing in the code changes.')
    console.log('Remove them with:  seed:telemetry -- --org ' + orgSlug + ' --purge')
  } finally {
    await sql.end()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
