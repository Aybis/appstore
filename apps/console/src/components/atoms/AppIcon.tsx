import type { CSSProperties } from 'react'

/**
 * Deterministic icon colour per app.
 *
 * Deliberately LIGHT, because the initials drawn on them are near-black. The
 * first pass used saturated mid-tones and measured 3.9:1 on two of the six —
 * one app in three would have had unreadable initials. These clear 7.5:1 at
 * worst.
 */
const PALETTE = ['#FF9AAC', '#FFB088', '#F5CE55', '#7ED4A0', '#9CB8FF', '#D0A0EE']

export const colorFor = (seed: string): string => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

export const initialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

interface AppIconProps {
  /** Picks the colour; the slug, so an app keeps its colour when renamed. */
  seed: string
  /** Initials are drawn from this. */
  name: string
  /** Square size, e.g. `'3.5rem'`. Defaults to the stylesheet's 3rem. */
  size?: string
  /** `app-icon` by default; lists and rankings use their own sizing class. */
  className?: string
  style?: CSSProperties
}

/** An app's generated mark: its initials on a colour derived from the slug. */
export const AppIcon = ({ seed, name, size, className = 'app-icon', style }: AppIconProps) => (
  <span
    className={className}
    style={{ background: colorFor(seed), ...(size && { width: size, height: size }), ...style }}
    aria-hidden="true"
  >
    {initialsFor(name)}
  </span>
)
