import type { ReactNode } from 'react'

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="state">
    <div className="state-spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
)

export const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="state">
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
)

export const Failed = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="state state-error">
    <h3>Something went wrong</h3>
    <p>{error}</p>
    {onRetry && (
      <button className="btn btn-ghost btn-sm" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
)

export const Card = ({ children }: { children: ReactNode }) => (
  <div className="card">{children}</div>
)

export const TrackPill = ({ track }: { track: string }) => (
  <span className={`pill pill-${track}`}>{track}</span>
)
