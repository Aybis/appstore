/**
 * The app mark.
 *
 * Recoloured with the console's accent: a violet mark beside a coral interface
 * reads as two products rather than one. The MOBILE app still draws the violet
 * version, so the two are out of step until one of them moves — a deliberate,
 * recorded gap rather than an oversight.
 *
 * Bars are white now, not near-black: they were dark because the old gradient
 * was pale lavender, and on this deeper coral they would disappear.
 */
export const MayaMark = ({ size = 32 }: { size?: number }) => {
  const id = `maya-mark-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8395C" />
          <stop offset="55%" stopColor="#FF5A78" />
          <stop offset="100%" stopColor="#FF8FA3" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      {/* Three ascending bars — a catalog growing, and legible at 22px. */}
      <rect x="13" y="27" width="6" height="9" rx="3" fill="#FFFFFF" />
      <rect x="21" y="20" width="6" height="16" rx="3" fill="#FFFFFF" />
      <rect x="29" y="13" width="6" height="23" rx="3" fill="#FFFFFF" />
    </svg>
  )
}
