/**
 * Sidebar icons.
 *
 * Hand-drawn on a 24-grid rather than pulled from an icon set: five icons do
 * not justify a dependency, and a set would bring its own stroke weight and
 * corner radius to argue with the rest of the console.
 *
 * `currentColor` throughout, so an icon inherits the link's colour and the
 * active state needs no separate rule. Marked aria-hidden because every one of
 * them sits beside a real text label — announcing both would read the
 * destination twice.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const AppsIcon = () => (
  <svg {...base}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
)

export const TestingIcon = () => (
  <svg {...base}>
    <path d="M9 3v6.5L4.5 17A2.5 2.5 0 0 0 6.6 21h10.8a2.5 2.5 0 0 0 2.1-4L15 9.5V3" />
    <path d="M8 3h8" />
    <path d="M7 14h10" />
  </svg>
)

export const PeopleIcon = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3" />
    <path d="M17.5 14.5a5.5 5.5 0 0 1 3 5.5" />
  </svg>
)

export const KeysIcon = () => (
  <svg {...base}>
    <circle cx="7.5" cy="12" r="3.5" />
    <path d="M11 12h9" />
    <path d="M17 12v3" />
    <path d="M20 12v2" />
  </svg>
)

export const AuditIcon = () => (
  <svg {...base}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H14l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
)

export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
)
