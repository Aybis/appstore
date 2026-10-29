/**
 * Creates a login for an org that already exists.
 *
 *   pnpm --filter @appstore/api db:seed:member -- <org-slug> <email> <password> [role]
 *
 * Signup (POST /v1/auth/signup) is the only sanctioned way to create an org AND
 * its first owner together. This script covers the other case: an org that was
 * created by ingestion and has no members yet, so there is nobody to
 * authenticate as. It reuses the same argon2 parameters as PasswordService.
 */
import '../src/config/load-env'
import { migrationUrl } from '../src/config/migration-url'
import argon2 from 'argon2'
import postgres from 'postgres'

const main = async (): Promise<void> => {
  const [orgSlug, email, password, role = 'owner'] = process.argv.slice(2)
  if (!orgSlug || !email || !password) {
    throw new Error('usage: seed-member <org-slug> <email> <password> [role]')
  }

  const url = migrationUrl()

  const sql = postgres(url, { max: 1 })
  try {
    const [org] = await sql<{ id: string }[]>`
      select id from organizations where slug = ${orgSlug}
    `
    if (!org) throw new Error(`no organization with slug "${orgSlug}"`)

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })

    const [user] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, display_name)
      values (${email}, ${passwordHash}, ${email.split('@')[0]})
      on conflict (email) do update set password_hash = excluded.password_hash
      returning id
    `

    // memberships is org-scoped and RLS-forced, so the GUC has to be set even
    // though this script runs as the schema owner.
    await sql.unsafe(`set app.current_org_id = '${org.id}'`)
    await sql`
      insert into memberships (org_id, user_id, role)
      values (${org.id}, ${user.id}, ${role}::membership_role)
      on conflict (org_id, user_id) do update set role = excluded.role
    `

    console.log(`${email} is now ${role} of ${orgSlug} (org ${org.id})`)
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
