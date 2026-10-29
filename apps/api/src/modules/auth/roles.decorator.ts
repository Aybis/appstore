import { SetMetadata } from '@nestjs/common'
import type { MembershipRole } from './token.service'

export const ROLES_KEY = 'roles'

/**
 * Requires at least one role — `(first, ...rest)` rather than `(...roles)` —
 * so `@Roles()` with no arguments cannot compile. A zero-argument call would
 * silently mean "any authenticated member", which is one thing when it's the
 * ABSENCE of the decorator (RolesGuard's documented behavior) but a trap when
 * it's the decorator written with an empty argument list: `getAllAndOverride`
 * prefers handler-level metadata over class-level, so `@Roles()` on a method
 * under a controller-level `@Roles('admin')` would silently DOWNGRADE that
 * one method to authenticated-only instead of inheriting 'admin'. Making the
 * empty call unrepresentable removes that failure mode at compile time
 * instead of relying on every future author noticing it. See
 * task-7-report.md, round 1, M1.
 */
export const Roles = (first: MembershipRole, ...rest: MembershipRole[]) => SetMetadata(ROLES_KEY, [first, ...rest])
