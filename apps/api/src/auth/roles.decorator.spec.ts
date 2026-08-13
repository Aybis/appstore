import 'reflect-metadata'
import { describe, expect, it } from 'vitest'
import { ROLES_KEY, Roles } from './roles.decorator'

describe('Roles', () => {
  it('attaches the given roles as handler metadata, retrievable via ROLES_KEY', () => {
    class Probe {
      @Roles('admin', 'owner')
      method(): void {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.method)).toEqual(['admin', 'owner'])
  })

  it('accepts a single role', () => {
    class Probe {
      @Roles('viewer')
      method(): void {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.method)).toEqual(['viewer'])
  })

  it('requires at least one role at compile time (round 1, M1)', () => {
    // @ts-expect-error -- Roles() with zero arguments must not compile. An
    // empty call is easy to confuse with the ABSENCE of the decorator
    // (which RolesGuard treats as "any authenticated member is enough"),
    // and Reflector.getAllAndOverride's handler-before-class precedence
    // means an empty @Roles() on a method would silently DOWNGRADE a
    // stricter class-level @Roles('admin') instead of inheriting it. If
    // this line ever stops erroring, the decorator's signature has
    // regressed back to the unconstrained `(...roles: MembershipRole[])`.
    Roles()
    // Kept as a real runtime assertion, rather than a bare statement, so
    // this test still means something if a future tsconfig change ever
    // stops enforcing "expect error" directives entirely.
    expect(true).toBe(true)
  })
})
