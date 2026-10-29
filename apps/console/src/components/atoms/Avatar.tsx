import { colorFor, initialsFor } from './AppIcon'

interface AvatarProps {
  /** Photo URL; the initials are drawn when it is empty. */
  url: string
  name: string
  size?: number
}

/** A person: their photo, or their initials on a colour derived from the name. */
export const Avatar = ({ url, name, size = 32 }: AvatarProps) =>
  url ? (
    <img className="avatar" src={url} alt="" width={size} height={size} />
  ) : (
    <span
      className="avatar avatar-initials"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initialsFor(name || '?')}
    </span>
  )
