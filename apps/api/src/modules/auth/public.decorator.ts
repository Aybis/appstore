import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Opts a route (or an entire controller) OUT of the globally-registered
 * `JwtGuard`/`RolesGuard` (see `auth.module.ts`'s `APP_GUARD` providers).
 *
 * As of round 1's M4 fix, every route in this application requires
 * authentication by default — a controller that forgets to decorate itself
 * is DENIED, not silently public. `@Public()` is the explicit, auditable
 * opt-out for the handful of routes that must stay open: `GET /health`,
 * `POST /v1/auth/signup`, `POST /v1/auth/login`. Both guards check this
 * before doing anything else (before extracting a bearer token, before
 * querying `memberships`), so a public route pays no auth cost at all.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
