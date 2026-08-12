import { ConflictException, Inject, Injectable } from '@nestjs/common'
import type { SignupInput } from '@appstore/shared'
import { PasswordService } from '../auth/password.service'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'
import { withTenant } from '../db/tenant'

export interface SignupResult {
  orgId: string
  userId: string
}

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class SignupService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Runs outside withTenant deliberately: the org does not exist yet, so there
   * is no tenant context to adopt. The whole thing is one transaction — a
   * half-created org with no owner is unrecoverable through the API.
   *
   * The membership insert is the one exception. `memberships` carries FORCE
   * RLS, and the connection behind `DATABASE`/`db` is always app_runtime (see
   * .env.example — the app never authenticates as the schema owner, locally or
   * on Supabase). There is no ambient bypass to lean on here. But by the time
   * we reach the membership insert the organization row already exists in this
   * same transaction — uncommitted, but visible to this session's own later
   * statements — so its id is a legitimate tenant to adopt. Scoping just this
   * insert through `withTenant` (nested on the open transaction, not a second
   * transaction) is the sanctioned way to satisfy the policy instead of
   * loosening it.
   */
  async signUp(input: SignupInput): Promise<SignupResult> {
    const email = input.email.trim().toLowerCase()
    const passwordHash = await this.passwords.hash(input.password)

    try {
      return await this.db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({ slug: input.orgSlug, name: input.orgName })
          .returning()

        const [user] = await tx
          .insert(users)
          .values({ email, passwordHash, displayName: input.displayName })
          .returning()

        await withTenant(tx, org!.id, (scopedTx) =>
          scopedTx.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' }),
        )

        // withTenant's SET LOCAL settings are made inside a SAVEPOINT (drizzle
        // turns this nested withTenant call into one), and a LOCAL setting
        // made inside a savepoint PERSISTS past RELEASE SAVEPOINT into the
        // enclosing transaction — see tenant.ts. So `tx`, from this line
        // onward, is still scoped to `app_runtime` / this org until the
        // OUTER transaction commits or rolls back. Any statement added below
        // this point runs tenant-scoped, not unscoped — a future addition
        // here should account for that rather than assume a clean slate.
        await this.afterMembershipInsert()

        return { orgId: org!.id, userId: user!.id }
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('That organization slug or email is already registered')
      }
      throw error
    }
  }

  /**
   * Test seam only — a no-op in production, never overridden outside specs.
   * Runs inside the signup transaction immediately after the membership
   * insert's savepoint has released, so a test can override it to force a
   * failure at exactly that point and prove the WHOLE transaction (org,
   * user, and membership together) still rolls back, not just the plain,
   * pre-savepoint failures the other tests already cover. See
   * signup.service.spec.ts's "rolls back ... after the membership savepoint
   * releases" test.
   */
  protected async afterMembershipInsert(): Promise<void> {}
}

/**
 * drizzle-orm 0.45.2 wraps the driver error in a DrizzleQueryError whose own
 * `.code` is undefined — the SQLSTATE lives on `.cause.code` (the wrapped
 * postgres-js PostgresError). Checking the top-level error's `.code` alone
 * silently never matches, which is worse than not checking at all: every
 * unique violation would fall through to the generic 500 branch instead of
 * becoming a 409.
 */
function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === UNIQUE_VIOLATION
}
