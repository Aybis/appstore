import { TRACK_LABELS, type ReleaseTrack } from '@appstore/shared/tracks'
import type { ReactNode } from 'react'

export type PillTone = 'internal' | 'beta' | 'production' | 'danger'

export const Pill = ({ tone, title, children }: { tone: PillTone | string; title?: string; children: ReactNode }) => (
  <span className={`pill pill-${tone}`} title={title}>
    {children}
  </span>
)

/**
 * The release stage, named the way the team names it.
 *
 * The raw enum value stays as the class hook and the tooltip: the colour
 * mapping keys on it, and somebody cross-referencing the audit log — which
 * records the enum, not the label — needs a way to line the two up.
 */
export const TrackPill = ({ track }: { track: string }) => (
  <Pill tone={track} title={track}>
    {TRACK_LABELS[track as ReleaseTrack]?.label ?? track}
  </Pill>
)
