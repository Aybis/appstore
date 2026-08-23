/** The app mark, matching the SVG the mobile app draws. */
export const MayaMark = ({ size = 32 }: { size?: number }) => {
  const id = `maya-mark-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="55%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#C4B5FD" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      {/* Three ascending bars — a catalog growing, and legible at 22px. */}
      <rect x="13" y="27" width="6" height="9" rx="3" fill="#17121F" />
      <rect x="21" y="20" width="6" height="16" rx="3" fill="#17121F" />
      <rect x="29" y="13" width="6" height="23" rx="3" fill="#17121F" />
    </svg>
  )
}
