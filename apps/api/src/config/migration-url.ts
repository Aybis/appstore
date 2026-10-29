/**
 * The connection for work done as the schema owner: migrations, seeds,
 * ingest and storage:tidy.
 *
 * MIGRATION_DATABASE_URL only — never a fallback to DATABASE_URL. In
 * production DATABASE_URL is the Supabase transaction pooler (port 6543),
 * which hands each statement to whichever backend is free. A migration then
 * fails half way, and anything that binds the tenant with a session-level SET
 * (storage:tidy, the seeds) silently sees no rows at all — for storage:tidy,
 * that means every file in the bucket looks like an orphan.
 */
export const migrationUrl = (): string => {
  const url = process.env.MIGRATION_DATABASE_URL
  if (!url) {
    throw new Error(
      'Set MIGRATION_DATABASE_URL in the root .env: the schema owner connection ' +
        '(locally postgres://localhost:5433/appstore; on Supabase the session pooler or the ' +
        'direct host, both port 5432).',
    )
  }
  if (new URL(url).port === '6543') {
    throw new Error(
      'MIGRATION_DATABASE_URL points at the Supabase transaction pooler (port 6543). Use ' +
        'port 5432 on the same host (session mode) or the direct db.<REF>.supabase.co:5432.',
    )
  }
  return url
}
