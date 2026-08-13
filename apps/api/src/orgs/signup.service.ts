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
const ORG_SLUG_CONSTRAINT = 'organizations_slug_key'
const USER_EMAIL_CONSTRAINT = 'users_email_key'

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
      // Design decision, round 2: signup discloses whether an email is
      // already registered; login does NOT (LoginService's uniform-failure
      // path). This asymmetry is deliberate, not an oversight.
      //
      // Login can be made uniform because every failure path can be forced
      // to do the same work and return the same body — nothing about a
      // failed login is externally observable except that body. Signup
      // cannot: a SUCCESSFUL signup's own side effect, the new
      // `organizations` row, is itself externally observable the moment a
      // slug becomes unavailable — and slug collisions are deliberately
      // disclosed honestly, because slugs are a public namespace a would-be
      // customer needs to check. Given that, an attacker who can already
      // learn "is this slug free" for free can always recover "is this
      // email registered" from a synchronous signup endpoint in at most two
      // requests, no matter what the direct response body says.
      //
      // Round 1 tried hiding the direct response instead (a decoy 201 +
      // token pair for a duplicate email). It was defeated: probe the same
      // slug twice — once with the target email, once with any fresh email
      // — and whichever request finds the slug still free (201) reveals
      // that the first one rolled back, i.e. the target email was already
      // registered. The decoy also had a measurable timing tell (skips the
      // membership insert/savepoint) and, worse, handed an unauthenticated
      // caller a structurally valid `role: 'owner'` JWT for a nonexistent
      // org — a cost for zero real benefit. See task-6-report.md, round 2.
      //
      // True non-disclosure would require decoupling account creation from
      // the HTTP response entirely — e.g. respond 202 Accepted and create
      // nothing until a verification email's link is followed — which is a
      // distinct feature (email delivery, a pending-signup table, a
      // confirmation endpoint), not a fix to this endpoint. Out of scope
      // for this task; flagged for a future one.
      const violation = identifyUniqueViolation(error)
      if (violation === 'org_slug') {
        throw new ConflictException('That organization slug is already registered')
      }
      if (violation === 'user_email') {
        throw new ConflictException('That email is already registered')
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
 *
 * Beyond the SQLSTATE, `cause.constraint_name` identifies WHICH unique index
 * fired — verified empirically against this repo's actual schema (a
 * duplicate `organizations.slug` insert reports `constraint_name:
 * 'organizations_slug_key'`; a duplicate `users.email` insert reports
 * `'users_email_key'`). That distinction is what lets `signUp` return a
 * disclosure decision to its caller instead of baking one in: a slug
 * collision is safe to report plainly, a duplicate email is not (I2).
 *
 * This function is coupled to two hardcoded index names —
 * `ORG_SLUG_CONSTRAINT` / `USER_EMAIL_CONSTRAINT` above. Renaming either
 * constraint in a future migration without updating the matching constant
 * here silently breaks this function for that case: it falls through to
 * `return null`, and `signUp` re-throws the raw `DrizzleQueryError` instead
 * of a `ConflictException` — a duplicate signup becomes a 500 instead of a
 * 409. That is itself a distinguishable signal (500 vs 409), so treat it as
 * a real regression, not a cosmetic one. `signup.service.spec.ts` ("rejects
 * a duplicate organization slug", "rejects a duplicate email") and
 * `auth.e2e-spec.ts` ("still reports an organization-slug collision
 * plainly", the duplicate-email 409 test) both pin this — don't rename
 * either constraint without updating both call sites and watching those
 * tests stay green.
 */
function identifyUniqueViolation(error: unknown): 'org_slug' | 'user_email' | null {
  const cause = error instanceof Error ? error.cause : undefined
  if (typeof cause !== 'object' || cause === null || !('code' in cause) || cause.code !== UNIQUE_VIOLATION) {
    return null
  }
  if (!('constraint_name' in cause)) {
    return null
  }
  if (cause.constraint_name === ORG_SLUG_CONSTRAINT) {
    return 'org_slug'
  }
  if (cause.constraint_name === USER_EMAIL_CONSTRAINT) {
    return 'user_email'
  }
  return null
}
