/**
 * How release stages are NAMED, kept apart from how they are VALIDATED.
 *
 * This module deliberately imports nothing at runtime — `ReleaseTrack` comes in
 * as a type, which the compiler erases. That is the whole point: publish.ts
 * builds zod schemas at module scope, and rollup cannot prove a `z.object()`
 * call is side-effect free, so anything importing from it drags zod along.
 * The console wanted three labels and got 14 kB of validator with them.
 *
 * Import this directly (`@appstore/shared/tracks`) from a browser bundle.
 */
import type { ReleaseTrack } from './publish.js'

/** Re-exported so a browser bundle can name the type without importing the
 *  schema module that defines it — and with it, zod. */
export type { ReleaseTrack }

/** Promotion order. A build only ever moves forward through these. */
export const TRACK_ORDER = ['internal', 'beta', 'production'] as const

export interface TrackPresentation {
  /** What the release stage is called in the UI. */
  label: string
  /** Who can actually see a build sitting here. */
  audience: string
}

/**
 * The names people use, mapped onto the names the database keeps.
 *
 * Teams describe releases as environments — dev, then staging (prod-like),
 * then production — so those are the words the console shows. The enum itself
 * stays `internal | beta | production`, for the same reason the membership
 * roles did: every historical `releases.track` value and every audit event
 * already carries the old word, and renaming the enum would silently restate
 * what those rows said at the time.
 *
 * WORTH BEING PRECISE ABOUT: a track controls WHO CAN SEE a build, not what
 * the build points at. "Staging" here means the binary is visible to QA and
 * named testers — not that it was compiled against a staging API. That
 * distinction matters because promotion never rebuilds: the artifact QA
 * approved is bit-for-bit the one that reaches everyone. A build genuinely
 * compiled against a different backend is a different artifact and belongs to
 * a different release, not a different track.
 */
export const TRACK_LABELS: Record<ReleaseTrack, TrackPresentation> = {
  internal: {
    label: 'Development',
    audience: 'Your team only. Nobody is notified.',
  },
  beta: {
    label: 'Staging',
    audience: 'QA and the testers you name. Prod-like, before release.',
  },
  production: {
    label: 'Production',
    audience: 'Everyone in the organization.',
  },
}

/** The stage name on its own — the common case at a call site. */
export const trackLabel = (track: ReleaseTrack): string => TRACK_LABELS[track].label
