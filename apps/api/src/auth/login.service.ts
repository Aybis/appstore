import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { LoginInput } from '@appstore/shared'
import { eq } from 'drizzle-orm'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'
import { withTenant } from '../db/tenant'
import { PasswordService } from './password.service'
import { TokenService, type TokenPair } from './token.service'

/**
 * No organization is ever assigned this id (Postgres generates org ids via
 * `defaultRandom()`, which can't produce the nil UUID). Used to scope the
 * membership lookup when the org slug doesn't resolve to a real
 * organization, so that path still runs a `withTenant`-scoped query — same
 * shape of work as the happy path — instead of short-circuiting.
 */
const NO_SUCH_ORG_ID = '00000000-0000-0000-0000-000000000000'

@Injectable()
export class LoginService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Every failure path returns the same message and does the same amount of
   * work, so response content and timing do not reveal whether an org exists,
   * whether an email is registered, or which of the two was wrong.
   *
   * `organizations` carries no RLS, so resolving the slug is a plain read.
   * `memberships` carries FORCE RLS, so it can only be read through
   * `withTenant` — which is also what enforces "must be a member of the org
   * being logged into": a membership row that belongs to a different org is
   * invisible under this scope, not merely filtered out by a WHERE clause.
   * When the slug doesn't resolve, the lookup is scoped to `NO_SUCH_ORG_ID`
   * instead of skipped, so an unknown org still pays for a real
   * `withTenant`-scoped query rather than returning early.
   */
  async login(input: LoginInput): Promise<TokenPair> {
    const email = input.email.trim().toLowerCase()

    const [org] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, input.orgSlug))
      .limit(1)
    const orgId = org?.id ?? NO_SUCH_ORG_ID

    const rows = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({ userId: users.id, passwordHash: users.passwordHash, role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(users.email, email))
        .limit(1),
    )

    const row = rows[0]
    const hash = row?.passwordHash ?? DUMMY_HASH
    const ok = await this.passwords.verify(hash, input.password)

    if (!row || !ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.tokens.issue({ sub: row.userId, orgId, role: row.role })
  }
}

/** Verified against when no user matches, to keep failure timing uniform. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'
