import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** A "← back" link above the title. */
  back?: { to: string; label: string }
  /** Drawn left of the title — an app's icon on its detail page. */
  leading?: ReactNode
  /** Right-hand side: the page's primary action or a filter. */
  children?: ReactNode
  /** Entrance animation; off for pages that render the header after a load. */
  animate?: boolean
}

export const PageHeader = ({ title, description, back, leading, children, animate = true }: PageHeaderProps) => {
  const text = (
    <div>
      {back && (
        <Link to={back.to} className="back-link">
          ← {back.label}
        </Link>
      )}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  )

  return (
    <div className={animate ? 'page-head rise' : 'page-head'}>
      {leading ? (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {leading}
          {text}
        </div>
      ) : (
        text
      )}
      {children}
    </div>
  )
}
