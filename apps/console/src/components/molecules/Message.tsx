import type { CSSProperties, ReactNode } from 'react'

const CLASS = { error: 'err-msg', success: 'ok-msg', notice: 'notice' } as const

interface MessageProps {
  tone: keyof typeof CLASS
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** An inline result line: what went wrong, what just worked, or a standing note. */
export const Message = ({ tone, children, className, style }: MessageProps) => (
  <p
    className={[CLASS[tone], className].filter(Boolean).join(' ')}
    style={style}
    role={tone === 'error' ? 'alert' : undefined}
  >
    {children}
  </p>
)
